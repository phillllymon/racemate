

fetch("https://racematevercel.vercel.app/api/auth/signUp",  {
// fetch("http://localhost:3000/api/auth/signUp",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    myVar: "my peepee"
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});