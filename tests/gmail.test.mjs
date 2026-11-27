// Sending a CV share from Gmail: the address boxes, safe headers, the message itself.
// Run: node --no-warnings tests/gmail.test.mjs
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  buildMime,
  encodeWords,
  gmailThreadUrl,
  noteHtml,
  noteText,
  readAddresses,
  sendProblem,
  signatureText,
  wrap76,
} from "../lib/google/gmail-core.ts";

let n = 0;
const ok = (c, m) => (assert.ok(c, m), n++);

// The To and CC boxes
const r = readAddresses("ta@example.com, Partner@Example.co.in; Asha Rao <asha@example.com>\n ta@EXAMPLE.com");
ok(r.emails.join(" ") === "ta@example.com Partner@Example.co.in asha@example.com" && !r.bad.length, "reads commas, semicolons, new lines and Name <address>, without repeats");
ok(readAddresses("not-an-email, a@b").bad.length === 2, "anything that isn't an address is pointed out");
ok(readAddresses("").emails.length === 0 && readAddresses(null).emails.length === 0, "an empty box is just empty");

// Headers can't be broken into
const decode = (h) =>
  h
    .split(/\r\n /)
    .map((w) => {
      const m = w.match(/^=\?UTF-8\?B\?(.*)\?=$/);
      return m ? Buffer.from(m[1], "base64").toString("utf8") : w;
    })
    .join("");
ok(encodeWords("Asha Rao · TMT associate, Mumbai").split("\r\n ").every((w) => w.length <= 75), "a non-English subject is encoded in short words");
ok(decode(encodeWords("Asha Rao · TMT associate, Mumbai")) === "Asha Rao · TMT associate, Mumbai", "and reads back exactly");
ok(decode(encodeWords("प्रिया शर्मा · कॉर्पोरेट")) === "प्रिया शर्मा · कॉर्पोरेट", "Hindi names survive, never split mid-letter");
ok(encodeWords("Plain subject") === "Plain subject", "plain English stays as it is");
ok(!/[\r\n]/.test(encodeWords("Hello\r\nBcc: someone@example.com")), "a subject can't sneak in a Bcc line");

// The message
const pdf = new Uint8Array(3000).map((_, i) => (i * 7) % 256);
const mime = buildMime(
  {
    from: { name: "Kopal Verma", email: "kopal@example.com" },
    to: ["partner@example.com", "x@example.com\r\nBcc: someone@example.com"],
    cc: ["ta@example.com", "hr@example.com"],
    subject: "Asha Rao · Associate, Mumbai",
    text: "Hi Neha,\n\nCV attached.",
    html: noteHtml("Hi Neha,\n\nCV attached."),
    attachments: [
      { fileName: "Asha Rao - Paradigm Shifters.pdf", mimeType: "application/pdf", bytes: pdf },
      { fileName: "आशा राव CV.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array([1, 2, 3]) },
    ],
  },
  "=_covaro_test",
);
writeFileSync("/tmp/covaro-test.eml", mime);
ok(/^[\x00-\x7f]*$/.test(mime), "the whole message is ASCII");
ok(mime.split("\r\n").every((l) => l.length <= 998), "no line is too long for mail servers");
ok(mime.includes('From: "Kopal Verma" <kopal@example.com>'), "it comes from the person, by name");
ok(/^To: partner@example\.com$/m.test(mime) && !/^Bcc:/im.test(mime), "an address carrying a hidden Bcc line is dropped");
ok(mime.includes("Cc: ta@example.com,\r\n hr@example.com"), "copies the others, folded neatly");
ok(mime.includes('Content-Type: multipart/mixed; boundary="=_covaro_test_m"'), "a note with files attached");
ok(mime.includes("filename*=UTF-8''%E0%A4%86%E0%A4%B6%E0%A4%BE%20%E0%A4%B0%E0%A4%BE%E0%A4%B5%20CV.docx"), "a Hindi file name is kept");
const pdfPart = mime.split("--=_covaro_test_m").find((p) => p.includes("Paradigm Shifters.pdf"));
const pdfB64 = pdfPart.split("\r\n\r\n")[1].replace(/\s+/g, "");
ok(Buffer.from(pdfB64, "base64").equals(Buffer.from(pdf)), "the attached PDF arrives byte for byte");
ok(wrap76("A".repeat(200)).split("\r\n").every((l) => l.length <= 76), "files are cut into 76-character lines");

// The note and the signature
const html = noteHtml("Hi <Neha> & team,\nSecond line", '<div dir="ltr">Kopal Verma<br>Paradigm Shifters</div>');
ok(html.includes("Hi &lt;Neha&gt; &amp; team,<br>") && html.includes("gmail_signature") && html.includes("Kopal Verma<br>Paradigm Shifters"), "the note is escaped and their Gmail signature goes under it");
ok(!noteHtml("x", "").includes("gmail_signature"), "no signature, no empty block");
const sig = '<div dir="ltr"><b>Kopal Verma</b><br>Paradigm Shifters &amp; Co<div><a href="tel:+919000000001">+91 90000 00001</a>&nbsp;</div><style>p{}</style></div>';
ok(signatureText(sig) === "Kopal Verma\nParadigm Shifters & Co\n+91 90000 00001", "the signature reads cleanly as plain text");
ok(noteText("Regards,\nKopal", sig).endsWith("-- \nKopal Verma\nParadigm Shifters & Co\n+91 90000 00001"), "the plain-text version signs off the usual way");

// Gmail's answers, in words
ok(/Connect Google again/.test(sendProblem(403, { error: { errors: [{ reason: "insufficientPermissions" }] } })), "a missing permission asks them to connect again");
ok(/internet/.test(sendProblem(null)), "no answer at all: check the internet");
ok(/To and CC/.test(sendProblem(400, { error: { message: "Invalid To header" } })), "a refused address says to check the addresses");
ok(/Try again in a minute/.test(sendProblem(503)), "Gmail having a bad moment: try again");
ok(gmailThreadUrl("18c2abc", "kopal@example.com") === "https://mail.google.com/mail/?authuser=kopal%40example.com#all/18c2abc", "opens the sent email in the right Gmail account");

console.log(`All ${n} Gmail checks passed.`);
