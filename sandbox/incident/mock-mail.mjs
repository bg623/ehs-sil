export class MockMail {
  constructor() {
    this.outbox = [];
  }

  send(message) {
    if (!message.to.endsWith(".example.invalid")) {
      throw new Error("Sandbox mail only accepts .example.invalid recipients");
    }
    this.outbox.push(structuredClone(message));
  }

  latest(to, purpose) {
    return [...this.outbox].reverse().find((item) => item.to === to && item.purpose === purpose);
  }
}
