//! The CLI, written once in Rust. `run_cli` is the single implementation; the Rust binary and
//! every language binding call it, so CLI behavior can't drift. Args are passed in (excluding
//! the program name); output goes to the host process's stdout/stderr; an exit code is returned
//! (never `process::exit`, so calling it in-process from Python/Node doesn't kill the host).

use std::io::Read;

use clap::Parser;

use crate::Counter;

#[derive(Parser, Debug)]
#[command(name = "mynewproduct", version, about, long_about = None, allow_negative_numbers = true)]
struct Cli {
    /// Text to count. Reads stdin when omitted.
    text: Vec<String>,

    /// Show only the N most common words.
    #[arg(long, default_value_t = 10)]
    top: i64,

    /// Count case-sensitively (by default words are lowercased).
    #[arg(long)]
    case_sensitive: bool,
}

/// Parse `args` (without the program name), run the counter, print `word\tcount` lines.
/// Returns the process exit code.
pub fn run_cli(args: Vec<String>) -> i32 {
    let argv = std::iter::once("mynewproduct".to_string()).chain(args);
    let cli = match Cli::try_parse_from(argv) {
        Ok(cli) => cli,
        // clap's --help / --version / parse errors carry their own text + exit code.
        Err(err) => {
            let _ = err.print();
            return err.exit_code();
        }
    };

    let text = if cli.text.is_empty() { read_stdin() } else { cli.text.join(" ") };
    let mut counter = Counter::new(cli.case_sensitive);
    counter.add(&text);
    match counter.most_common(cli.top) {
        Ok(entries) => {
            for e in entries {
                println!("{}\t{}", e.word, e.count);
            }
            0
        }
        Err(err) => {
            eprintln!("error: {err}");
            1
        }
    }
}

fn read_stdin() -> String {
    let mut s = String::new();
    std::io::stdin().read_to_string(&mut s).ok();
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_supplied_text() {
        assert_eq!(run_cli(vec!["the the fox".into()]), 0);
    }

    #[test]
    fn negative_top_returns_one() {
        assert_eq!(run_cli(vec!["--top".into(), "-1".into(), "hello".into()]), 1);
    }

    #[test]
    fn help_returns_zero() {
        assert_eq!(run_cli(vec!["--help".into()]), 0);
    }

    #[test]
    fn unknown_flag_returns_two() {
        assert_eq!(run_cli(vec!["--bogus".into()]), 2);
    }
}
