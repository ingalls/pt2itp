#[derive(Debug, PartialEq)]
pub enum Action {
    None,
    Create,
    Modify,
    Delete,
    Restore,
}
