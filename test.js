const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

fetch("https://racematevercel.vercel.app/api/auth/signUp",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    username: "Robert",
    email: "itsaRobert@gmail.com",
    password: "password123"
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});