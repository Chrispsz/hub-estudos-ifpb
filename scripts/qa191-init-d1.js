(function () {
  try {
    var FAKE = new Date('2026-09-30T12:00:00Z').getTime(); // 09:00 Brasília 30/09 (véspera)
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
