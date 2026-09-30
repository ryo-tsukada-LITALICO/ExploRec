const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveHumanLabel,
  buildClickDescription,
  buildInputDescription
} = require("../src/lib/label");

test("resolveHumanLabel uses strict priority", () => {
  const label = resolveHumanLabel({
    byFor: "forラベル",
    byWrap: "wrapラベル",
    byAriaLabel: "aria-label",
    byAriaLabelledBy: "aria-labelledby",
    byPlaceholder: "placeholder",
    byTitle: "title",
    tagName: "input",
    type: "email"
  });

  assert.equal(label, "forラベル");
});

test("resolveHumanLabel falls back by type", () => {
  assert.equal(resolveHumanLabel({ tagName: "input", type: "password" }), "パスワードのテキストボックス");
  assert.equal(resolveHumanLabel({ tagName: "input", type: "email" }), "メールアドレスのテキストボックス");
  assert.equal(resolveHumanLabel({ tagName: "textarea" }), "テキストエリア");
  assert.equal(resolveHumanLabel({ tagName: "select" }), "セレクトボックス");
});

test("buildClickDescription for button", () => {
  const text = buildClickDescription({
    targetTag: "button",
    label: "ログイン"
  });
  assert.equal(text, "『ログイン』ボタンをクリック");
});

test("buildInputDescription handles text/select/checkbox/radio", () => {
  assert.equal(
    buildInputDescription({ type: "text", label: "メールアドレスのテキストボックス", value: "foo@example.com" }),
    "メールアドレスのテキストボックスに「foo@example.com」と入力"
  );
  assert.equal(
    buildInputDescription({ type: "select-one", label: "言語", value: "日本語" }),
    "言語で「日本語」を選択"
  );
  assert.equal(
    buildInputDescription({ type: "checkbox", label: "利用規約", checked: true }),
    "利用規約をオンにした"
  );
  assert.equal(
    buildInputDescription({ type: "radio", label: "支払い方法", value: "クレジットカード" }),
    "支払い方法で「クレジットカード」を選択"
  );
});
