"use client";

export default function PaymentTestPage() {
  const handleClick = async () => {
    // ★ ここに「実在する Question の id」を貼る
    const questionId = "cmjubw0ml000hfow45clp0u85";

    const res = await fetch("/api/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 1000,      // ← テスト金額（円）
        questionId,        // ← ここで一緒に送る
      }),
    });

    const data = await res.json();
    console.log("🔵 /api/checkout/sessions response:", data);

    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      alert(`Error creating checkout session: ${data.error ?? "unknown"}`);
    }
  };

  return (
    <div>
      <h1>Stripe 決済テスト</h1>
      <button onClick={handleClick}>1000円で決済してみる</button>
    </div>
  );
}
