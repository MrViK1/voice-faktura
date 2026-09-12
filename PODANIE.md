# Submission copy — AssemblyAI Voice Agent Hackathon

Paste-ready text for the lablab.ai project page. Nothing here is final until the author approves it.

---

## Project name

**Voice Faktura**

## Tagline (one line)

**Say it in Ukrainian. File it in Polish.**

## Short description

Speak Ukrainian — get a legally valid Polish FA(3) e-invoice, ready for KSeF.
Built for the 1.5 million Ukrainians running businesses in Poland who must issue
every invoice electronically, in Polish, from 1 January 2027.

## Long description

**An invoice that says "VAT exempt" is rejected by Poland's tax system unless it names the
article of law behind the exemption — and the person dictating it has no idea.**

Voice Faktura listens in Ukrainian and issues the invoice in Polish. It knows the clause.

### The problem

About 1.5 million Ukrainians live in Poland, and many run a sole proprietorship. From
1 January 2027, every micro-entrepreneur must issue invoices electronically through **KSeF**,
the national e-invoicing system. The form is in Polish. The legal vocabulary is in Polish.
The exemption clauses are in Polish. So a person who runs a real business but thinks in
Ukrainian either learns tax law in a foreign language or pays an accountant per invoice.

### What you do

Press one button and say one sentence:

> «Катерина Сергіївна. Консультація 450. Супровід по карті побиту 4350. Фотографії 100.
> Додаткові розходи 750 і внески 1185. Це приватна особа без ПДВ.»

You get a five-line Polish invoice — konsultacja, pomoc w sprawie karty pobytu, usługi
fotograficzne, dodatkowe koszty, składki — the total written out in Polish with correct
declension (*sześć tysięcy osiemset trzydzieści pięć złotych 00/100 groszy*), and valid
**FA(3) XML** against the Ministry of Finance schema.

### Why it is an agent, not a dictation box

1. **It remembers.** Each sentence adds to the invoice instead of replacing it. Name the
   buyer now, the amounts a minute later.
2. **It asks back, by voice,** for what is missing — one question at a time: buyer → amount
   → for what → NIP or private person.
3. **It knows the law the speaker does not.** A `zw.` rate without a legal basis is rejected
   by KSeF. The app offers the four real statutory bases and emits `P_19A` for Polish law,
   `P_19B` for the EU directive.
4. **It handles the language people actually speak.** Ukrainian declines names; Polish
   invoices need the nominative — Ковальському → Kowalski, Петра Івановича → Petro Iwanowicz.
   It also merges subunits spoken apart: «1755 злотих 71 грош» → 1755.71, one line, not two.

### How AssemblyAI is used

**`universal-3-5-pro`** for transcription, for its native **code-switching**: real speech here
mixes Ukrainian grammar with Polish terms — *karta pobytu*, *stawka*, *netto* — and each word
comes back in the language it was spoken in. **`keyterms_prompt`** is primed with the domain
vocabulary: invoice terms, VAT wording, ~80 Polish given names and surnames. Without it the
model hears «Гош» for *Grzegorz* and «золотих» for «злотих», and the amount is lost.
Language is selectable: Ukrainian, Polish, or automatic detection.

### Built to survive the demo

Two parsers, on purpose. Rules run first — instant, offline, deterministic. The model runs
after and refines what no dictionary could cover. If the model is unavailable, the badge
switches to `словник` and the app keeps issuing invoices. A demo that dies with its LLM is
not a product.

### Honest scope

The FA(3) core — XML builder, NIP and bank-account checksums, VAT totals, pre-export
validator, amount-in-words — is reused unchanged from the author's existing invoicing
product. The hackathon work is the voice layer on top, and the decision to reuse a working
core instead of rewriting it. Sending to KSeF is deliberately not built: that is a licensed
integration. This produces the document; a human sends it.

## Tags

`voice-agent` `assemblyai` `speech-to-text` `code-switching` `invoicing` `ksef` `fa3`
`poland` `ukrainian` `tax-compliance` `migrants`

---

# Прохід маркетолога й продюсера — 12.09.2026

## Назва — рекомендація: лишити «Voice Faktura»

Не тому, що вона найкраща. Тому що:

| За | Проти |
|---|---|
| судді розуміють з першого погляду, мова не заважає | шаблон «Voice + щось» на хакатоні буде ще в десятка проєктів |
| `faktura` польською = фактура, українською так само — назва сама показує, про що це | нічого не каже про головне: що воно знає закон |
| уже стоїть в URL, репозиторії, README | |

**Перейменування за 16 днів до здачі коштує:** новий домен Vercel, новий репозиторій або
перейменування з битими посиланнями, правка README й цього файлу. Відмінності це не додасть —
їх додає теза, а не назва.

**ВІДКРИТО — вирішує Віталій.** Якщо хочете все-таки іншу, ось ті, що витримують перевірку
англомовним суддею: `Mów Fakturę` (польською «скажи фактуру» — місцево й чесно, але вони її
не вимовлять), `Faktura Vox`, `KSeF by Voice` (найзрозуміліша, найнудніша).

## Теза — вибрати одну з двох

1. **Say it in Ukrainian. File it in Polish.** — проста, симетрична, нічого не обіцяє зверх.
2. **The invoice knows the law. You just talk.** — продає саме те, що відрізняє нас від
   диктофона. Ризик: звучить як обіцянка юридичної послуги.

Маркетолог за другу, продюсер за першу (її легше сказати голосом у відео).
**ВІДКРИТО — вирішує Віталій.**

## Короткий опис — маркетингова версія

Хук перенесений у число, бо число судді запамʼятають, а «speak Ukrainian» — ні.

> **1.5 million Ukrainians run businesses in Poland** — and from January 2027 every invoice
> must be filed electronically, in Polish. Voice Faktura takes it by voice in Ukrainian and
> issues valid FA(3) XML for KSeF, exemption clause included.

## Продюсер — перші 15 секунд відео

Найдорожчі 15 секунд подачі. Суддя дивиться десятки відео; він або залишається тут, або йде.

**Не робити:** не починати з «Hi, my name is», не показувати спершу архітектуру,
не пояснювати, що таке KSeF, перш ніж він захотів це знати.

**Кадр 1 (0–5 с).** На екрані готова фактура. Голос за кадром, англійською:
> «This invoice will be rejected by the Polish tax office. Nothing on the screen tells you why.»

**Кадр 2 (5–10 с).** Курсор наводиться на `zw.`
> «A VAT-exempt line needs the article of law behind it. The man who dictated this invoice
> doesn't read Polish.»

**Кадр 3 (10–15 с).** Натиснути мікрофон, сказати речення українською.
> «So he talks.»

Далі — фактура збирається на очах, і аж потім усе інше. Правило продюсера: **спершу біль,
потім кнопка, і тільки потім як воно зроблено.** Технічну частину (AssemblyAI,
code-switching, два розбирачі) дати на 1:10–2:00, коли він уже хоче знати.

**Одна фраза, яку суддя перекаже іншому суддеві** — на неї працює все відео:
> «It's the one that knows the tax clause you forgot.»
