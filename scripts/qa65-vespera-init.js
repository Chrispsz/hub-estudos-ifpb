// QA Task 65 — simula 30/09/2026 (véspera da Av1, daysLeft=1) e semeia 1 erro
// real de exercício no acervo (mat-ex03, usado no plano D-6) para a linha 01
// do Kit da Véspera aparecer. Roda ANTES dos scripts da página em TODA navegação.
(function () {
  try {
    var FAKE = new Date('2026-09-30T12:00:00Z').getTime(); // 09:00 em Brasília (-03)
    var RealDate = Date;
    function FakeDate(...args) {
      if (args.length === 0) return new RealDate(FAKE);
      return new RealDate(...args);
    }
    FakeDate.prototype = RealDate.prototype;
    Object.getOwnPropertyNames(RealDate).forEach(function (p) {
      try {
        FakeDate[p] = RealDate[p];
      } catch (e) {
        /* getters do constructor — ignora */
      }
    });
    FakeDate.now = function () {
      return FAKE;
    };
    window.Date = FakeDate;
  } catch (e) {
    /* Date real — QA cai no caso "kit ausente" */
  }

  try {
    var KEY = 'hub-estudos-ifpb:v2';
    var raw = window.localStorage.getItem(KEY);
    var v = raw ? JSON.parse(raw) : {};
    v.exerciseProgress = v.exerciseProgress || {};
    // mat-ex03 existe no acervo estático (exercisePool do plano D-6) —
    // tried && !solved = erro pendente para o Caderno.
    v.exerciseProgress['mat-ex03'] = {
      tried: true,
      solved: false,
      marked: false,
      lastPracticedAt: new Date(FAKE).toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch (e) {
    /* storage indisponível — QA segue sem a linha de erros */
  }
})();
