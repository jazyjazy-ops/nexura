document.getElementById("registroForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const nombre = document.querySelector('input[name="nombre"]').value;
    const correo = document.querySelector('input[name="correo"]').value;
    const password = document.querySelector('input[name="password"]').value;
    
    const departamento = document.querySelector('select[name="departamento"]'.value); 

    try {
        const res = await fetch("http://localhost:3000/api/usuarios/registro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                nombre: nombre, 
                email: correo, 
                password: password,
                departamento: departamento
            }) 
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon:'success',
                title:'¡Registro exitoso!',
                text:'Cuenta creada correctamente',
                confirmButtonColor:'#3085d6',
                confirmButtonText: 'Ir a Iniciar Sesión'
            }).then((result) => {
                if (result.isConfirmed){
                    window.location.href = "login.html";
                }
            });
        } else if (res.status === 409) {
            Swal.fire({
                icon: 'warning',
                title: 'Usuario ya existente',
                text: 'El correo electrónico que intentas registrar ya pertenece a otra cuenta.',
                confirmButtonColor: '#f39c12'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message || 'Error al registrar al usuario',
                confirmButtonColor: '#f39c12'
            });
        }
    } catch(error) {
        console.error("Error de conexión:", error);
        Swal.fire({
                icon: 'error',
                title: 'Error de servidor',
                text: data.message || 'Error al registrar al usuario',
            });
    }
});