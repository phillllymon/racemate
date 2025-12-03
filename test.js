async function test() {
    const url = "https://racematevercel.vercel.app/api/users";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "testuser@example.com", password: "mypassword123" })
    });
    console.log(await response.json());
  }
  
  test().catch(console.error);
  