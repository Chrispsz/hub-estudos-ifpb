// Mock do relógio para o E2E da t184: força LOCAL 01/10 (D-0, dia da prova).
// Baseado no relógio REAL do navegador, deslocado até a meia-noite local de
// 01/10/2026 — funciona a partir de qualquer dia/hora do ambiente.
(function () {
  const RealDate = Date;
  // 01/10/2026 09:00 local — o alvo do mock (a manhã da prova)
  const TARGET = new RealDate(2026, 9, 1, 9, 0, 0).getTime();
  const now = RealDate.now();
  const OFFSET = TARGET - now;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + OFFSET);
      else if (args.length === 1) super(args[0]);
      else super(...args);
    }
    static now() {
      return RealDate.now() + OFFSET;
    }
  }
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  MockDate.prototype.constructor = MockDate;
  Object.defineProperty(window, 'Date', { value: MockDate, writable: true, configurable: true });
})();
