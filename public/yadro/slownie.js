/* Сума словами польською з відмінюванням.
   Узято без змін із faktura/src/app.js. Оригінал не торкався. */
(function (global) {
'use strict';
var JEDN = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
var NAST = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście',
            'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
var DZIES = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt',
             'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
var SETKI = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset',
             'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
var GRUPY = [['', '', ''], ['tysiąc', 'tysiące', 'tysięcy'], ['milion', 'miliony', 'milionów'],
             ['miliard', 'miliardy', 'miliardów']];

function grupaSlownie(n) {
  var s = [], setki = Math.floor(n / 100), reszta = n % 100;
  if (setki) s.push(SETKI[setki]);
  if (reszta >= 10 && reszta < 20) s.push(NAST[reszta - 10]);
  else {
    var d = Math.floor(reszta / 10), j = reszta % 10;
    if (d) s.push(DZIES[d]);
    if (j) s.push(JEDN[j]);
  }
  return s.join(' ');
}
function odmiana(n, formy) {
  if (n === 1) return formy[0];
  var d = n % 10, s = n % 100;
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return formy[1];
  return formy[2];
}
function liczbaSlownie(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  var czesci = [], grupa = 0;
  while (n > 0) {
    var g = n % 1000;
    if (g > 0) {
      var txt = grupaSlownie(g);
      if (grupa > 0) txt = (g === 1 ? '' : txt + ' ') + odmiana(g, GRUPY[grupa]);
      czesci.unshift(txt.trim());
    }
    n = Math.floor(n / 1000); grupa++;
  }
  return czesci.join(' ').replace(/\s+/g, ' ').trim();
}
function kwotaSlownie(kwota, wal) {
  var zl = Math.floor(Math.round(kwota * 100) / 100);
  var gr = Math.round((kwota - zl) * 100);
  var slowa = liczbaSlownie(zl);
  var setna = (gr < 10 ? '0' + gr : gr) + '/100';
  /* Польська відміна «złote/grosze» лише для PLN; для інших валют —
     число словами + код валюти (без хибного «złotych» на EUR). */
  if (!wal || wal === 'PLN') {
    return slowa + ' ' + odmiana(zl, ['złoty', 'złote', 'złotych']) + ' ' + setna + ' ' + odmiana(gr, ['grosz', 'grosze', 'groszy']);
  }
  return slowa + ' ' + wal + ' ' + setna;
}

/* Показ по-польськи: 4 551,00. У XML цього робити НЕ можна —
   схема вимагає крапки як роздільника. Тому дві різні функції. */
function pl(kwotaTekst) {
  var s = String(kwotaTekst).split('.');
  var calosc = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return calosc + ',' + (s[1] || '00');
}


var SLOWNIE = { liczbaSlownie: liczbaSlownie, kwotaSlownie: kwotaSlownie, odmiana: odmiana, pl: pl };
if (typeof module !== 'undefined' && module.exports) module.exports = SLOWNIE;
global.SLOWNIE = SLOWNIE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
