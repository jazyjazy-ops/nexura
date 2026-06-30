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
            alert("¡Usuario registrado exitosamente! Ahora puedes iniciar sesión.");
            
            window.location.href = "login.html";
        } else {
            alert(data.Mensaje || data.message || "Error al registrar el usuario");
        }
    } catch(error) {
        console.error("Error de conexión:", error);
        alert("Error al conectar con el servidor. Verifica que Golare esté encendido.");
    }
});