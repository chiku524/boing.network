//! Property tests: `Shl` / `Shr` / `Sar` vs `num-bigint` reference (Boing VM shift count rules in spec §7.2).

use boing_execution::Interpreter;
use boing_primitives::{Account, AccountId, AccountState};
use boing_state::StateStore;
use num_bigint::{BigInt, BigUint, Sign};
use proptest::prelude::*;

const CONTRACT: AccountId = AccountId([2u8; 32]);

fn mk_state() -> StateStore {
    let mut state = StateStore::new();
    state.insert(Account {
        id: CONTRACT,
        state: AccountState::default(),
    });
    state
}

fn push32(w: &[u8; 32]) -> Vec<u8> {
    let mut v = vec![0x7f];
    v.extend_from_slice(w);
    v
}

fn run_shift(op: u8, value: [u8; 32], shift_word: [u8; 32]) -> [u8; 32] {
    let mut code = push32(&value);
    code.extend(push32(&shift_word));
    code.push(op);
    code.push(0x00);
    let mut it = Interpreter::new(code, 10_000_000);
    let mut state = mk_state();
    it.run(CONTRACT, CONTRACT, &[], &mut state).unwrap();
    assert_eq!(it.stack.len(), 1);
    it.stack[0]
}

fn biguint_mod_2_256(bu: BigUint) -> [u8; 32] {
    let m = BigUint::from(1u8) << 256u32;
    let r = bu % m;
    let bytes = r.to_bytes_be();
    let mut out = [0u8; 32];
    if bytes.is_empty() {
        return out;
    }
    let len = bytes.len().min(32);
    out[32 - len..].copy_from_slice(&bytes[bytes.len() - len..]);
    out
}

fn expect_shl(value: &[u8; 32], shift_word: &[u8; 32]) -> [u8; 32] {
    let s = shift_word[31] as u32;
    let bu = BigUint::from_bytes_be(value);
    biguint_mod_2_256(bu << s)
}

fn expect_shr(value: &[u8; 32], shift_word: &[u8; 32]) -> [u8; 32] {
    let s = shift_word[31] as u32;
    let bu = BigUint::from_bytes_be(value);
    biguint_mod_2_256(bu >> s)
}

fn signed_bigint_to_i256_word(i: &BigInt) -> [u8; 32] {
    let mut bytes = i.to_signed_bytes_be();
    if bytes.is_empty() {
        return [0u8; 32];
    }
    let neg = matches!(i.sign(), Sign::Minus);
    let fill: u8 = if neg { 0xff } else { 0x00 };
    if bytes.len() > 32 {
        bytes = bytes[bytes.len() - 32..].to_vec();
    }
    let mut out = [fill; 32];
    let start = 32usize.saturating_sub(bytes.len());
    out[start..].copy_from_slice(&bytes);
    out
}

fn expect_sar(value: &[u8; 32], shift_word: &[u8; 32]) -> [u8; 32] {
    let s = shift_word[31] as u32;
    let i = BigInt::from_signed_bytes_be(&value[..]);
    let shifted = i >> s;
    signed_bigint_to_i256_word(&shifted)
}

fn arb_word() -> impl Strategy<Value = [u8; 32]> {
    proptest::collection::vec(any::<u8>(), 32).prop_map(|bytes| {
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        arr
    })
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(512))]

    #[test]
    fn prop_shl_mod_256(a in arb_word(), b in arb_word()) {
        let got = run_shift(0x1b, a, b);
        prop_assert_eq!(got, expect_shl(&a, &b));
    }

    #[test]
    fn prop_shr_logical(a in arb_word(), b in arb_word()) {
        let got = run_shift(0x1c, a, b);
        prop_assert_eq!(got, expect_shr(&a, &b));
    }

    #[test]
    fn prop_sar_signed(a in arb_word(), b in arb_word()) {
        let got = run_shift(0x1d, a, b);
        prop_assert_eq!(got, expect_sar(&a, &b));
    }
}
