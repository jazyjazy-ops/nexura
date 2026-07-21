// 1. CARGA INICIAL Y VALIDACIÓN DE SESIÓN
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('nexura_token');

    // Ahora el registro es una ruta privada. Si no hay sesión, al login.
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Llamamos a la función para llenar el selector
    await cargarRoles(token);
});

// 2. FUNCIÓN PARA DIBUJAR LOS ROLES DESDE LA BASE DE DATOS
async function cargarRoles(token) {
    try {
        const res = await fetch("http://localhost:3000/api/usuarios/roles", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("No se pudieron cargar los roles");
        
        const roles = await res.json();
        
        // Seleccionamos tu campo
        const selectRol = document.querySelector('select[name="departamento"]');
        selectRol.innerHTML = ''; 
        
        // Opción por defecto
        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = '-- Selecciona el departamento --';
        selectRol.appendChild(optDefault);
        
        // Creamos una opción por cada rol que envió el backend
        roles.forEach(rol => {
            const option = document.createElement('option');
            option.value = rol;
            option.textContent = rol;
            selectRol.appendChild(option);
        });

    } catch (error) {
        console.error("Error al cargar roles:", error);
    }
}

// 3. EVENTO DE ENVÍO DEL FORMULARIO
document.getElementById("registroForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    // Rescatamos el token para enviarlo al backend
    const token = localStorage.getItem('nexura_token');

    const nombre = document.querySelector('input[name="nombre"]').value;
    const correo = document.querySelector('input[name="correo"]').value;
    const password = document.querySelector('input[name="password"]').value;
    
    // CORRECCIÓN: El .value va fuera de los paréntesis
    const departamento = document.querySelector('select[name="departamento"]').value; 

    try {
        const res = await fetch("http://localhost:3000/api/usuarios/registro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // NUEVO: Enviamos el pase de entrada
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
                icon: 'success',
                title: '¡Registro exitoso!',
                text: 'Cuenta creada correctamente',
                confirmButtonColor: '#3085d6',
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
                text: data.Mensaje || data.message || 'Error al registrar al usuario', // Aseguramos que lea el mensaje correcto
                confirmButtonColor: '#f39c12'
            });
        }
    } catch(error) {
        console.error("Error de conexión:", error);
        // CORRECCIÓN: Quitamos data.message porque 'data' no existe aquí
        Swal.fire({
            icon: 'error',
            title: 'Error de servidor',
            text: 'No se pudo conectar con el servidor para registrar la cuenta.',
        });
    }
});