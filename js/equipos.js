let equiposGenerales = [];
let modoEdicion = false;
let equipoActualId = null;
let rolUsuarioActual = null;

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('nexura_token');
    const usuarioStr = localStorage.getItem('nexura_usuario');

    if (!token || !usuarioStr) {
        window.location.href = "login.html";
        return;
    }

    const usuario = JSON.parse(usuarioStr);
    document.getElementById('nombreUsuario').textContent = usuario.nombre;
    const rolDOM = document.getElementById('rolUsuario');
    if (rolDOM) rolDOM.textContent = usuario.departamento || 'Administración';
    
    rolUsuarioActual = usuario.departamento || usuario.rol;

    // 1. Validar permiso para botón "Agregar"
    const rolesTecnicos = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Jefe de Ingenieria', 'Ingeniero', 'Sistemas'];
    if (!rolesTecnicos.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });
    await cargarEquipos(token);

    document.getElementById('inputBusqueda').addEventListener('input', filtrarEquipos);
});

async function cargarEquipos(token) {
    try {
        const res = await fetch("http://localhost:3000/api/equipos", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (res.status === 403) {
            Swal.fire({ icon: "warning", title: "Acceso Denegado", text: "No tienes permisos para visualizar los equipos." });
            return;
        }

        equiposGenerales = await res.json();
        renderizarTabla(equiposGenerales);
    } catch (error) {
        console.error("Error al cargar equipos:", error);
    }
}

function renderizarTabla(equipos) {
    const tbody = document.getElementById('tablaEquipos');
    tbody.innerHTML = '';

    if (equipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No se encontraron equipos</td></tr>';
        return;
    }

    const rolesTecnicos = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Jefe de Ingenieria', 'Ingeniero', 'Sistemas'];
    const rolesEliminacion = ['Direccion', 'Sub-Direccion', 'Sistemas'];
    
    const puedeEditar = rolesTecnicos.includes(rolUsuarioActual);
    const puedeEliminar = rolesEliminacion.includes(rolUsuarioActual);

    equipos.forEach(eq => {
        const tr = document.createElement('tr');

        // Colores de estado
        let claseEstado = 'normal';
        if (eq.estado === 'Fuera de servicio') claseEstado = 'roja';
        if (eq.estado === 'En mantenimiento') claseEstado = 'amarilla';

        // Botones
        let botonesAccion = "";
        if (puedeEditar) botonesAccion += `<button class="btn-editar" onclick="prepararEdicion(${eq.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>`;
        if (puedeEliminar) botonesAccion += `<button class="btn-eliminar" onclick="eliminarEquipo(${eq.id})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Eliminar</button>`;
        if (!puedeEditar && !puedeEliminar) botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;

        tr.innerHTML = `
            <td>${eq.id}</td>
            <td><strong>${eq.nombre}</strong></td>
            <td>${eq.marca}</td>
            <td>${eq.modelo || 'N/A'}</td>
            <td><span class="estado ${claseEstado}">${eq.estado}</span></td>
            <td>${botonesAccion}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNCIONES DEL MODAL ---
window.prepararEdicion = function(id) {
    modoEdicion = true;
    equipoActualId = id;
    const eq = equiposGenerales.find(e => e.id === id);
    if (!eq) return;

    document.getElementById("tituloModal").textContent = "Editar equipo";
    
    document.getElementById('inputNombre').value = eq.nombre;
    document.getElementById('inputMarca').value = eq.marca;
    document.getElementById('inputModelo').value = eq.modelo || '';
    document.getElementById('selectEstado').value = eq.estado;

    abrirModalEquipo();
}

// --- GUARDAR CAMBIOS (POST/PUT) ---
document.getElementById('formEquipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

    const getValueOrNull = (id) => document.getElementById(id).value || null;

    const payload = {
        nombre: document.getElementById('inputNombre').value,
        marca: document.getElementById('inputMarca').value,
        modelo: getValueOrNull('inputModelo'),
        estado: document.getElementById('selectEstado').value
    };

    let url = "http://localhost:3000/api/equipos";
    let method = "POST";

    if (modoEdicion) {
        url = `http://localhost:3000/api/equipos/${equipoActualId}`;
        method = "PUT";
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.status === 403) {
            Swal.fire({ icon: "warning", title: "Acceso Denegado", text: "Permisos insuficientes." });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: modoEdicion ? 'Actualizado' : 'Guardado', timer: 1500, showConfirmButton: false });
            cerrarModalEquipo();
            await cargarEquipos(token);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.Mensaje || 'Error al guardar' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
    }
});

window.eliminarEquipo = async function(id) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar equipo?',
        text: "Se dará de baja del catálogo activo.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const token = localStorage.getItem('nexura_token');
        try {
            const res = await fetch(`http://localhost:3000/api/equipos/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.status === 403) {
                Swal.fire({ icon: "warning", title: "Acceso Denegado", text: "Solo directivos pueden eliminar equipos." });
                return;
            }

            const data = await res.json();
            if (res.ok) {
                Swal.fire('¡Eliminado!', 'El equipo fue dado de baja.', 'success');
                await cargarEquipos(token);
            } else {
                Swal.fire('Error', data.Mensaje, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de conexión.', 'error');
        }
    }
}

// --- FILTRADO SEGURO ---
function filtrarEquipos(e) {
    const termino = e.target.value.toLowerCase();
    const filtrados = equiposGenerales.filter(eq => {
        return (
            (eq.nombre && eq.nombre.toLowerCase().includes(termino)) ||
            (eq.marca && eq.marca.toLowerCase().includes(termino)) ||
            (eq.numero_serie && eq.numero_serie.toLowerCase().includes(termino)) ||
            (eq.cliente_nombre && eq.cliente_nombre.toLowerCase().includes(termino))
        );
    });
    renderizarTabla(filtrados);
}