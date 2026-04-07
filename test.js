const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

// fetch("https://racematevercel.vercel.app/api/updateBoat",  {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     userId: "6c990ce3-1ceb-44c5-9bdb-007c029081d2",
//     token: "65q6cg8l1z9e1b7bvpqd",
//     boatId: "4",
//     boatName: "Kari-J 2",
//     boatInfo: {"name":"Kari-J 2","type":"J-24"}
//   })
// }).then((res) => {
//   res.json().then((r) => {
//     console.log(r);
//   });
// });

// fetch("https://racematevercel.vercel.app/api/addBoat",  {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     userId: "6c990ce3-1ceb-44c5-9bdb-007c029081d2",
//     token: "65q6cg8l1z9e1b7bvpqd",
//     boatName: "Kari-J",
//     boatInfo: {"name":"Kari-J","type":"J-24"}
//   })
// }).then((res) => {
//   res.json().then((r) => {
//     console.log(r);
//   });
// });

// fetch("https://racematevercel.vercel.app/api/auth/signUp",  {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     username: "Parker",
//     email: "rparkerharris@gmail.com",
//     password: "password123"
//   })
// }).then((res) => {
//   res.json().then((r) => {
//     console.log(r);
//   });
// });

fetch("https://racematevercel.vercel.app/api/auth/signIn",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "rparkerharris@gmail.com",
    password: "password123"
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});

// fetch("https://racematevercel.vercel.app/api/deleteBoat",  {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     userId: "6c990ce3-1ceb-44c5-9bdb-007c029081d2",
//     token: "mjwd8xkthz58ghvk6lzy",
//     boatId: "17"
//   })
// }).then((res) => {
//   res.json().then((r) => {
//     console.log(r);
//   });
// });

// fetch("https://racematevercel.vercel.app/api/getClubMembers",  {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     userId: "6c990ce3-1ceb-44c5-9bdb-007c029081d2",
//     token: "fp3qt54jd8wkhq9b0q6f",
//     clubId: "1"
//   })
// }).then((res) => {
//   res.json().then((r) => {
//     console.log(r);
//   });
// });