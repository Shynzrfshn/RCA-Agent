/** Extract a small preview locally; the file itself is never uploaded. */
export async function readLocalAttachment(file: File): Promise<string> {
  if (file.size > 2_000_000) throw new Error("فایل باید کوچک‌تر از ۲ مگابایت باشد.");
  if (file.type === "text/plain" || /\.(txt|md|csv)$/i.test(file.name)) {
    return (await file.text()).slice(0, 6_000);
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new Error("فقط PDF و فایل متنی پشتیبانی می‌شود.");
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= Math.min(document.numPages, 5); i++) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
  } finally {
    await document.destroy();
  }
  const text = pages.join("\n").slice(0, 6_000).trim();
  if (!text) throw new Error("متن PDF قابل استخراج نیست؛ احتمالاً تصویر اسکن‌شده است.");
  return text;
}

