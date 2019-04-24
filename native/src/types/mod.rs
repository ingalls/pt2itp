mod address;
mod network;
mod polygon;

mod name;
mod context;
pub mod hecate;

pub trait ToPG {
    fn to_tsv(self) -> String;
}

pub use self::address::Address;
pub use self::network::Network;
pub use self::polygon::Polygon;

pub use self::name::Name;
pub use self::name::Names;
pub use self::context::Context;
pub use self::context::InputContext;
