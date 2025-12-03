fetch("/api/hello").then((res) => {
    res.json().then((r) => {
        console.log(r);
    });
});