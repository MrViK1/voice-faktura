# Voice Faktura

**Speak Ukrainian — get a legally valid Polish FA(3) e-invoice.**

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) (lablab.ai, September 2026).

---

## The problem

About **1.5 million Ukrainians live in Poland**, and many run a sole proprietorship (JDG).
From **1 January 2027** every micro-entrepreneur in Poland must issue invoices
electronically through **KSeF**, the national e-invoicing system.

The form is in Polish. The legal vocabulary is in Polish. The exemption clauses are
in Polish. A person who runs a real business in Poland but thinks in Ukrainian has to
either learn tax law in a foreign language or pay an accountant for every single invoice.

## What this does

You press one button and say, in Ukrainian:

> «Катерина Сергійовна. Консультація 450. Супровід по карті побиту 4350.
> Фотографії 100. Додаткові розходи 750 і внески 1185. Це приватна особа без ПДВ.»

You get a five-line Polish invoice:

| # | Nazwa towaru / usługi | Cena netto | VAT |
|---|---|---|---|
| 1 | konsultacja | 450,00 | zw. |
| 2 | pomoc w sprawie karty pobytu | 4 350,00 | zw. |
| 3 | usługi fotograficzne | 100,00 | zw. |
| 4 | dodatkowe koszty | 750,00 | zw. |
| 5 | składki | 1 185,00 | zw. |

…plus the amount in written Polish with correct declension
(*sześć tysięcy osiemset trzydzieści pięć złotych 00/100 groszy*), and a valid
**FA(3) XML** ready for KSeF.

## What makes it a voice *agent*, not a dictation tool

**1. It remembers the conversation.** Each new sentence *adds to* the invoice instead of
replacing it. You can say the buyer first and the amounts a minute later.

**2. It asks back — by voice — for what is missing**, one question at a time:
who is the buyer → what is the amount → for what → NIP or private person.

**3. It knows Polish law that the user does not.** This is the part that matters.
An invoice with a `zw.` (exempt) rate is **rejected by KSeF** unless it carries the legal
basis for the exemption. Nothing in the spoken sentence tells you that. The app knows,
and offers the real statutory options:

| Option | When |
|---|---|
| `art. 113 ust. 1 ustawy o VAT` | not a VAT payer — turnover under 200 000 zł (most common) |
| `art. 43 ust. 1 ustawy o VAT` | exempt by type of service: medical, educational, financial |
| `art. 82 ust. 3 ustawy o VAT` | exemption introduced by ministerial regulation |
| `art. 132 dyrektywy 2006/112/WE` | EU-law basis — emitted as `P_19B`, not `P_19A` |

**4. It handles the language the user actually speaks.** Ukrainian grammar declines names,
Polish invoices need the nominative:

| Spoken (Ukrainian, declined) | On the invoice (Polish) |
|---|---|
| Ковальському, Шевченку, Кравчуку | Kowalski, Szewczenko, Krawczuk |
| Петра Івановича | Petro Iwanowicz |
| Ірина Іванівна | Iryna Iwaniwna |
| карта побиту / по бету / pobytu | `pomoc w sprawie karty pobytu` |

It also merges Polish currency subunits spoken separately —
*«1755 злотих 71 грош»* becomes `1755.71`, not two invoice lines.

## How AssemblyAI is used

- **`universal-3-5-pro`** for transcription, with native **code-switching**: real speech here
  mixes Ukrainian grammar with Polish terms (*karta pobytu*, *stawka*, *netto*), and each word
  is transcribed in the language it was spoken in.
- **`keyterms_prompt`** primed with the domain vocabulary — invoice terms, VAT wording, and
  ~80 Polish given names and surnames. Without it the model hears *«Гош»* for *Grzegorz*
  and *«золотих»* for *«злотих»*, and the amount is lost.
- Language is selectable: Ukrainian, Polish, or automatic detection.

## Two parsers, on purpose

| Layer | Role |
|---|---|
| **Rule-based** (`public/yadro/rozbir.js`) | instant, offline, deterministic. Anchors each spoken amount as one invoice line, resolves Ukrainian name cases, maps services to Polish |
| **Model** (`api/extract.js`) | handles wording nobody put in a dictionary, any declension, free speech |

The model runs *after* the rules and refines the result. If the model is unavailable —
rate limit, network, outage — the badge next to **ФАКТУРА** switches to `словник`
and the app keeps working. A demo that dies with its LLM is not a product.

## The FA(3) core is not new code

`public/yadro/fa3.js` and `public/yadro/slownie.js` come from the author's existing
invoicing project, unchanged: the FA(3) XML builder, NIP and bank-account checksums,
VAT totals, the pre-export validator, and Polish amount-in-words with declension.
The schema in `schema/FA3.xsd` is the real one published by the Polish Ministry
of Finance.

The hackathon work is the voice layer on top — and the decision to reuse a working core
rather than rewrite it.

## Running locally

```bash
cp .env.example .env     # add your keys
node server.js           # http://localhost:5173
node test-lancuh.js      # three scripted conversations → FA(3) validation
```

`ASSEMBLYAI_API_KEY` is required. `GROQ_API_KEY` is optional — without it the rule-based
parser is used.

## Status

Working end to end: microphone → transcript → invoice lines → validated FA(3) XML → download.
The automated test runs three full conversations and all three pass FA(3) validation.

Not built, deliberately: accounts, database, invoice history, and sending to KSeF.
Sending is a licensed integration and a separate piece of work — this demo produces the
document, a human sends it.
