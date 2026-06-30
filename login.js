document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const nombre = document.querySelector('input[name="nombre"]').value;
    const password = document.querySelector('input[name="password"]').value;

    try {
        const res = await fetch("http://localhost:3000/api/usuarios/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nombre: nombre, password: password }) 
        });

        const data = await res.json();

        if (res.ok && data.token) {
            
            localStorage.setItem('nexura_token', data.token);
            localStorage.setItem('nexura_usuario', JSON.stringify(data.user));

            alert(`¡Bienvenido(a) ${data.user.nombre}!`);
            window.location.href = "panel.html";
        } else {
            alert(data.Mensaje || "Error al iniciar sesión");
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        alert("Error al conectar con el servidor.");
    }
});