document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const correo = document.querySelector('input[name="correo"]').value;
    const password = document.querySelector('input[name="password"]').value;

    const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ correo, password })
    });

    const data = await res.json();

    if (data.success) {
        alert("Login correcto");
        window.location.href = "dashboard.html";
    } else {
        alert("Usuario o contraseña incorrectos");
    }
}); 