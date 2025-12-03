async function test() {
    // const url = "https://racematevercel.vercel.app/api/users"; // <-- replace this
    const url = "https://racematevercel.vercel.app/api/hello"; // <-- replace this
  
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
    // console.log(result);
}

test().catch(console.error);