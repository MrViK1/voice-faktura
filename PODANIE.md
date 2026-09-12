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
