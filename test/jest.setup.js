global.console = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: console.debug,
    trace: console.trace,
}
