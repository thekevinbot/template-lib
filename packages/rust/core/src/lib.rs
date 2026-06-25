//! `mynewproduct` — the single source of truth.
//!
//! This crate is the canonical SDK: an idiomatic Rust API, plus the CLI ([`run_cli`]). The
//! Python (PyO3) and TS (napi) bindings re-expose *this* code in-process as idiomatic SDKs —
//! each binding IS that language's SDK; there is no separate veneer. **All behavior lives
//! here**; the bindings only cross the FFI boundary and reshape the surface into each idiom.
//!
//! The example kernel is a word-frequency `Counter` — the smallest API that still exercises a
//! constructor option, mutation, queries, a collection accessor, and one fallible method with a
//! typed error. Replace it with your own logic; keep the discipline (no logic in the bindings).

use std::collections::BTreeMap;
use std::fmt;

mod cli;
pub use cli::run_cli;

/// Errors the core can return. Bindings map these into each language's idiomatic error type (a
/// Python exception, a thrown JS `Error`) — but the *decision* of what is an error is made
/// here, once.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CountError {
    /// `most_common` was asked for a negative count.
    NegativeN(i64),
}

impl fmt::Display for CountError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CountError::NegativeN(n) => write!(f, "most_common: n must be >= 0, got {n}"),
        }
    }
}

impl std::error::Error for CountError {}

/// A word in the counter together with how many times it occurred.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub word: String,
    pub count: u64,
}

/// Tallies word frequencies over text streamed in via [`Counter::add`].
#[derive(Debug, Clone)]
pub struct Counter {
    case_sensitive: bool,
    counts: BTreeMap<String, u64>,
    total: u64,
}

impl Counter {
    /// Create an empty counter. With `case_sensitive = false`, words are lowercased.
    pub fn new(case_sensitive: bool) -> Self {
        Self { case_sensitive, counts: BTreeMap::new(), total: 0 }
    }

    /// Tokenize `text` on non-alphanumeric boundaries and tally each word.
    pub fn add(&mut self, text: &str) {
        for raw in text.split(|c: char| !c.is_alphanumeric()) {
            if raw.is_empty() {
                continue;
            }
            let word = if self.case_sensitive { raw.to_string() } else { raw.to_lowercase() };
            *self.counts.entry(word).or_insert(0) += 1;
            self.total += 1;
        }
    }

    /// Frequency of `word` (0 if absent). Honors the counter's case sensitivity.
    pub fn count(&self, word: &str) -> u64 {
        let key = if self.case_sensitive { word.to_string() } else { word.to_lowercase() };
        self.counts.get(&key).copied().unwrap_or(0)
    }

    /// Total tokens added.
    pub fn total(&self) -> u64 {
        self.total
    }

    /// Number of distinct words.
    pub fn distinct(&self) -> u64 {
        self.counts.len() as u64
    }

    /// All entries in a deterministic order: count descending, then word ascending.
    pub fn entries(&self) -> Vec<Entry> {
        let mut v: Vec<Entry> =
            self.counts.iter().map(|(w, c)| Entry { word: w.clone(), count: *c }).collect();
        v.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.word.cmp(&b.word)));
        v
    }

    /// The `n` most common entries. Errors on negative `n` (the one fallible path, used to
    /// demonstrate typed-error propagation through every binding).
    pub fn most_common(&self, n: i64) -> Result<Vec<Entry>, CountError> {
        if n < 0 {
            return Err(CountError::NegativeN(n));
        }
        Ok(self.entries().into_iter().take(n as usize).collect())
    }
}

/// Version of the core, surfaced through every SDK.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    const CORPUS: &str = "the quick brown fox the lazy dog The QUICK fox";

    fn loaded() -> Counter {
        let mut c = Counter::new(false);
        c.add(CORPUS);
        c
    }

    #[test]
    fn counts_case_insensitively() {
        let c = loaded();
        assert_eq!(c.total(), 10);
        assert_eq!(c.distinct(), 6);
        assert_eq!(c.count("THE"), 3);
        assert_eq!(c.count("missing"), 0);
    }

    #[test]
    fn most_common_is_deterministic_with_tiebreak() {
        let c = loaded();
        let top = c.most_common(3).unwrap();
        // the=3; then fox=2 and quick=2 tie -> word ascending -> fox before quick.
        assert_eq!(
            top,
            vec![
                Entry { word: "the".into(), count: 3 },
                Entry { word: "fox".into(), count: 2 },
                Entry { word: "quick".into(), count: 2 },
            ]
        );
    }

    #[test]
    fn most_common_zero_is_empty() {
        assert_eq!(loaded().most_common(0).unwrap(), vec![]);
    }

    #[test]
    fn negative_n_errors() {
        assert_eq!(loaded().most_common(-1), Err(CountError::NegativeN(-1)));
    }

    #[test]
    fn negative_n_error_displays() {
        assert_eq!(CountError::NegativeN(-3).to_string(), "most_common: n must be >= 0, got -3");
    }

    #[test]
    fn case_sensitive_distinguishes() {
        let mut c = Counter::new(true);
        c.add("The the THE");
        assert_eq!(c.count("the"), 1);
        assert_eq!(c.distinct(), 3);
    }

    #[test]
    fn entries_full_order() {
        let c = loaded();
        let words: Vec<String> = c.entries().into_iter().map(|e| e.word).collect();
        assert_eq!(words, ["the", "fox", "quick", "brown", "dog", "lazy"]);
    }
}
