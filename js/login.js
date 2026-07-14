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

            Swal.fire({
                icon: 'success',
                title:'Acceso concedido',
                text:`Bienvenido(a) ${data.user.nombre}`,
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                 window.location.href = "panel.html";
            });

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error de autenticación',
                text: data.message || 'Credenciales inválidas',
                confirmButtonColor: '#3085d6'
            });
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor'
        });
    }
});