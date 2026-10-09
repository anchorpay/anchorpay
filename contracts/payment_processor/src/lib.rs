//! AnchorPay Payment Processor Contract
//!
//! Handles USDC payment collection for Nigerian bill payments.
//! Flow:
//!   1. User calls `initiate_payment` — USDC locked in contract escrow
//!   2. Backend fulfils bill via VTPass, then calls `release_payment`
//!   3. If fulfilment fails within timeout, user calls `refund`

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

// ─── Storage keys ────────────────────────────────────────────────────────────

const ADMIN_KEY: &str = "admin";
const USDC_TOKEN_KEY: &str = "usdc";
const FEE_BPS_KEY: &str = "fee_bps"; // basis points, e.g. 50 = 0.5%
const TREASURY_KEY: &str = "treasury";

// ─── Data types ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Payment {
    pub id: String,
    pub payer: Address,
    pub amount_usdc: i128, // in stroops (7 decimal places)
    pub fee_usdc: i128,
    pub bill_type: String,  // "airtime" | "data" | "electricity" | "cable"
    pub bill_ref: String,   // phone number, meter number, smart card, etc.
    pub bill_amount: i128,  // NGN amount in kobo
    pub status: PaymentStatus,
    pub created_at: u64,
    pub expiry_ledger: u32, // refund available after this ledger
}

#[contracttype]
pub enum DataKey {
    Payment(String),
    PaymentCount,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct PaymentProcessor;

#[contractimpl]
impl PaymentProcessor {
    // ── Admin: initialise contract ────────────────────────────────────────

    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        treasury: Address,
        fee_bps: u32,
    ) {
        if env.storage().instance().has(&symbol_short!("admin")) {
            panic!("already initialised");
        }
        admin.require_auth();
        env.storage()
            .instance()
            .set(&symbol_short!("admin"), &admin);
        env.storage()
            .instance()
            .set(&symbol_short!("usdc"), &usdc_token);
        env.storage()
            .instance()
            .set(&symbol_short!("treasury"), &treasury);
        env.storage()
            .instance()
            .set(&symbol_short!("fee"), &fee_bps);
    }

    // ── User: lock USDC for a bill payment ───────────────────────────────

    pub fn initiate_payment(
        env: Env,
        payment_id: String,
        payer: Address,
        amount_usdc: i128,   // total USDC the user is sending (inclusive of fee)
        bill_type: String,
        bill_ref: String,
        bill_amount_ngn_kobo: i128,
    ) -> Payment {
        payer.require_auth();

        // Ensure payment_id is unique
        let key = DataKey::Payment(payment_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("payment_id already exists");
        }

        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&symbol_short!("fee"))
            .unwrap_or(50u32);
        let fee_usdc = amount_usdc * fee_bps as i128 / 10_000;
        let net_usdc = amount_usdc - fee_usdc;

        // Transfer USDC from payer into this contract
        let usdc_token: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("usdc"))
            .unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&payer, &env.current_contract_address(), &amount_usdc);

        let payment = Payment {
            id: payment_id.clone(),
            payer: payer.clone(),
            amount_usdc: net_usdc,
            fee_usdc,
            bill_type,
            bill_ref,
            bill_amount: bill_amount_ngn_kobo,
            status: PaymentStatus::Pending,
            created_at: env.ledger().timestamp(),
            // ~30 minutes at ~6s per ledger = 300 ledgers
            expiry_ledger: env.ledger().sequence() + 300,
        };

        env.storage()
            .persistent()
            .set(&key, &payment);

        // Emit event so backend can pick it up
        env.events().publish(
            (symbol_short!("initiated"), payer),
            (payment_id, amount_usdc, net_usdc),
        );

        payment
    }

    // ── Admin: release payment after successful fulfilment ────────────────

    pub fn release_payment(env: Env, payment_id: String, admin: Address) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);

        let key = DataKey::Payment(payment_id.clone());
        let mut payment: Payment = env
            .storage()
            .persistent()
            .get(&key)
            .expect("payment not found");

        if payment.status != PaymentStatus::Pending {
            panic!("payment not pending");
        }

        payment.status = PaymentStatus::Released;
        env.storage().persistent().set(&key, &payment);

        // Transfer net amount to treasury
        let usdc_token: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("usdc"))
            .unwrap();
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        // Net + fee both go to treasury; treasury handles downstream settlement
        token_client.transfer(
            &env.current_contract_address(),
            &treasury,
            &(payment.amount_usdc + payment.fee_usdc),
        );

        env.events().publish(
            (symbol_short!("released"), payment.payer),
            payment_id,
        );
    }

    // ── User: refund after expiry ─────────────────────────────────────────

    pub fn refund(env: Env, payment_id: String) {
        let key = DataKey::Payment(payment_id.clone());
        let mut payment: Payment = env
            .storage()
            .persistent()
            .get(&key)
            .expect("payment not found");

        if payment.status != PaymentStatus::Pending {
            panic!("payment not pending");
        }
        if env.ledger().sequence() < payment.expiry_ledger {
            panic!("payment not yet expired");
        }

        payment.payer.require_auth();
        payment.status = PaymentStatus::Refunded;
        env.storage().persistent().set(&key, &payment);

        // Refund full amount (net + fee) to payer
        let usdc_token: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("usdc"))
            .unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &payment.payer,
            &(payment.amount_usdc + payment.fee_usdc),
        );

        env.events().publish(
            (symbol_short!("refunded"), payment.payer.clone()),
            payment_id,
        );
    }

    // ── View ──────────────────────────────────────────────────────────────

    pub fn get_payment(env: Env, payment_id: String) -> Payment {
        let key = DataKey::Payment(payment_id);
        env.storage()
            .persistent()
            .get(&key)
            .expect("payment not found")
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    fn assert_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("admin"))
            .expect("not initialised");
        if *caller != admin {
            panic!("not admin");
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env, String,
    };

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let payer = Address::generate(&env);

        // Deploy a test USDC token
        let usdc_id = env.register_stellar_asset_contract_v2(admin.clone());
        let usdc_address = usdc_id.address();

        // Mint USDC to payer
        let asset_client = StellarAssetClient::new(&env, &usdc_address);
        asset_client.mint(&payer, &100_000_000); // 10 USDC (7 decimals)

        (env, admin, treasury, payer, usdc_address)
    }

    #[test]
    fn test_initiate_and_release() {
        let (env, admin, treasury, payer, usdc) = setup();

        let contract_id = env.register_contract(None, PaymentProcessor);
        let client = PaymentProcessorClient::new(&env, &contract_id);

        client.initialize(&admin, &usdc, &treasury, &50u32);

        let payment_id = String::from_str(&env, "pay_001");
        let payment = client.initiate_payment(
            &payment_id,
            &payer,
            &5_000_000i128, // 0.5 USDC
            &String::from_str(&env, "airtime"),
            &String::from_str(&env, "08012345678"),
            &100_000i128, // ₦1,000
        );

        assert_eq!(payment.status, PaymentStatus::Pending);

        client.release_payment(&payment_id, &admin);

        let released = client.get_payment(&payment_id);
        assert_eq!(released.status, PaymentStatus::Released);
    }

    #[test]
    fn test_refund_after_expiry() {
        let (env, admin, treasury, payer, usdc) = setup();

        let contract_id = env.register_contract(None, PaymentProcessor);
        let client = PaymentProcessorClient::new(&env, &contract_id);

        client.initialize(&admin, &usdc, &treasury, &50u32);

        let payment_id = String::from_str(&env, "pay_002");
        client.initiate_payment(
            &payment_id,
            &payer,
            &5_000_000i128,
            &String::from_str(&env, "electricity"),
            &String::from_str(&env, "12345678901"),
            &500_000i128,
        );

        // Fast-forward ledger past expiry
        env.ledger().with_mut(|info| {
            info.sequence_number += 301;
        });

        client.refund(&payment_id);

        let refunded = client.get_payment(&payment_id);
        assert_eq!(refunded.status, PaymentStatus::Refunded);
    }
}
