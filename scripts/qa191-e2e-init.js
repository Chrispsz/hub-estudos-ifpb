(function () {
  try {
    var FAKE = new Date('2026-10-02T00:30:00Z').getTime(); // 21:30 de 01/10 em Brasília
    var RealDate = Date;
    function FakeDate(...args) {
      if (args.length === 0) return new RealDate(FAKE);
      return new RealDate(...args);
    }
    FakeDate.prototype = RealDate.prototype;
    Object.getOwnPropertyNames(RealDate).forEach(function (p) { try { FakeDate[p] = RealDate[p]; } catch (e) {} });
    FakeDate.now = function () { return FAKE; };
    window.Date = FakeDate;
  } catch (e) {}
})();
