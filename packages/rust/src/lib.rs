use clap::Parser;

#[derive(Parser, Debug)]
#[command(
    name = "darkfactory",
    version,
    about = "ONNX kernel cost calibration toolkit",
    long_about = None,
)]
pub struct Cli {}

pub fn run<I, T>(args: I) -> anyhow::Result<i32>
where
    I: IntoIterator<Item = T>,
    T: Into<std::ffi::OsString> + Clone,
{
    let _cli = Cli::try_parse_from(args)?;
    Ok(0)
}
