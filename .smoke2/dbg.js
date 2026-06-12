import { jsx, jsxs } from "react/jsx-runtime";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const win = dom.window;
globalThis.window = win;
globalThis.document = win.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function Demo() {
  const [v, setV] = useState("");
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("input", { value: v, onChange: (e) => {
      console.log("onChange:", e.target.value);
      setV(e.target.value);
    } }),
    /* @__PURE__ */ jsx("span", { id: "out", children: v })
  ] });
}
async function main() {
  const c = win.document.createElement("div");
  win.document.body.appendChild(c);
  const root = createRoot(c);
  await act(async () => root.render(/* @__PURE__ */ jsx(Demo, {})));
  const el = c.querySelector("input");
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(el, "hello");
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
  console.log("out =", c.querySelector("#out").textContent);
}
main();
