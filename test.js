async function test() {
    const url = "https://racematevercel.vercel.app/api/users/index.js"; // <-- replace this
    // const url = "https://racematevercel.vercel.app/api/hello"; // <-- replace this
  
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "testuser@example.com",
            password: "mypassword123"
        })
    });
  
    const result = await response;
    console.log(result);
    result.json().then((r) => {
        console.log(r);
    })
}

test().catch(console.error);