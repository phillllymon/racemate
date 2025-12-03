async function test() {
    const url = "https://racematevercel.vercel.app/api/users"; // your project URL
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "testuser@example.com", password: "mypassword123" })
    });
  
    console.log("Status:", resp.status);
    const txt = await resp.text();
    console.log("Body:", txt);
  }
  
  test().catch(console.error);