let clientesGenerales = [];
let modoEdicion = false;
let clienteActualId = null;
let rolUsuarioActual = null;

// --- VARIABLES DE PAGINACIÓN ---
let paginaActual = 1;
const registrosPorPagina = 10;
let datosFiltradosActuales = [];

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

    // 1. Ocultar botón de agregar según el rol
    // (Solo directivos, administración y el área comercial pueden registrar clientes)
    const rolesCreacion = ['Direccion', 'Sub-Direccion', 'Gerencia de Ventas', 'Vendedor', 'Sistemas', 'Gerencia de Administracion'];
    if (!rolesCreacion.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });

    await cargarClientes(token);

    // Evento de búsqueda
    document.getElementById('inputBusqueda').addEventListener('input', filtrarClientes);
});

// --- 1. CARGAR DATOS DEL SERVIDOR ---
async function cargarClientes(token) {
    try {
        const res = await fetch("http://localhost:3000/api/clientes", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos para visualizar la cartera de clientes."
            });
            return;
        }

        const clientes = await res.json();
        // Filtramos para no mostrar los clientes inactivos
        clientesGenerales = clientes.filter(c => c.estado !== 'Inactivo');
        
        // Inicializamos los datos filtrados
        datosFiltradosActuales = [...clientesGenerales];
        
        // Llamamos a la tabla paginada
        renderizarTablaPaginada();
    } catch (error) {
        console.error("Error al cargar clientes:", error);
    }
}

// --- 2. RENDERIZAR TABLA PAGINADA CON ESTADÍSTICAS Y PERMISOS ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaClientes');
    tbody.innerHTML = '';

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron clientes</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin para cortar el arreglo
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const clientesPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    // Definición de jerarquía de botones
    const rolesCreacion = ['Direccion', 'Sub-Direccion', 'Gerencia de Ventas', 'Vendedor', 'Sistemas', 'Gerencia de Administracion'];
    const rolesEliminacion = ['Direccion', 'Sub-Direccion', 'Sistemas'];

    const puedeEditar = rolesCreacion.includes(rolUsuarioActual);
    const puedeEliminar = rolesEliminacion.includes(rolUsuarioActual);

    // Iteramos SOLO sobre los clientes de la página actual
    clientesPagina.forEach(c => {
        const tr = document.createElement('tr');
        
        // Formateo de fecha si existe
        let fechaFormateada = "Sin compras";
        if (c.fecha_ultima_compra) {
            const fechaObj = new Date(c.fecha_ultima_compra);
            fechaFormateada = fechaObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
        }

        // Construcción de botones de acción
        let botonesAccion = "";
        // Dentro de tu renderizarTablaPaginada()
        botonesAccion += `<button onclick="abrirHistorial(${c.id}, '${c.nombre}')" style="background-color: #2ecc71; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Historial</button>`;
        if (puedeEditar) {
            botonesAccion += `<button class="btn-editar" onclick="prepararEdicion(${c.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>`;
        }
        if (puedeEliminar) {
            botonesAccion += `<button class="btn-eliminar" onclick="eliminarCliente(${c.id})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Eliminar</button>`;
        }
        if (!puedeEditar && !puedeEliminar) {
            botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;
        }

        tr.innerHTML = `
            <td>${c.id}</td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.razon_social || 'N/A'}</td>
            <td>${c.telefono || 'N/A'}</td>
            <td>${c.direccion || 'N/A'}</td>
            <td>${c.ultima_compra || 'Ninguna'}</td>
            <td>${fechaFormateada}</td>
            <td>${c.producto_favorito || 'N/A'}</td>
            <td><span class="estado normal">${c.total_compras || 0}</span></td>
            <td>${botonesAccion}</td>
        `;
        tbody.appendChild(tr);
    });

    // Dibujamos los controles de paginación
    renderizarControlesPaginacion(datosFiltradosActuales.length);
}

// --- NUEVA FUNCIÓN: CONTROLES DE PAGINACIÓN ---
function renderizarControlesPaginacion(totalRegistros) {
    const contenedor = document.getElementById('controlesPaginacion');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (totalRegistros <= registrosPorPagina) return; 

    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

    const btnAnterior = document.createElement('button');
    btnAnterior.textContent = 'Anterior';
    btnAnterior.disabled = paginaActual === 1;
    btnAnterior.onclick = () => {
        paginaActual--;
        renderizarTablaPaginada();
    };

    const textoPagina = document.createElement('span');
    textoPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;

    const btnSiguiente = document.createElement('button');
    btnSiguiente.textContent = 'Siguiente';
    btnSiguiente.disabled = paginaActual === totalPaginas;
    btnSiguiente.onclick = () => {
        paginaActual++;
        renderizarTablaPaginada();
    };

    contenedor.appendChild(btnAnterior);
    contenedor.appendChild(textoPagina);
    contenedor.appendChild(btnSiguiente);
}

// --- MODIFICACIÓN: FILTRADO EN TIEMPO REAL ---
function filtrarClientes(e) {
    const termino = e.target.value.toLowerCase();
    
    // Actualizamos los datos filtrados
    datosFiltradosActuales = clientesGenerales.filter(c => {
        return (
            (c.nombre && c.nombre.toLowerCase().includes(termino)) ||
            (c.correo && c.correo.toLowerCase().includes(termino)) ||
            (c.telefono && c.telefono.toLowerCase().includes(termino)) ||
            String(c.id).includes(termino)
        );
    });
    
    // Reiniciamos a la página 1 al filtrar
    paginaActual = 1;
    renderizarTablaPaginada();
}

// --- 3. FUNCIONES DEL MODAL ---
window.prepararNuevoCliente = function() {
    modoEdicion = false;
    clienteActualId = null;
    document.querySelector('#modalCliente h2').textContent = 'Agregar cliente';
    document.getElementById('formCliente').reset();
    abrirModal();
}

// Vincular el botón "Agregar" global del HTML
const btnAgregar = document.querySelector(".btn-agregar");
if(btnAgregar) btnAgregar.onclick = window.prepararNuevoCliente;

window.prepararEdicion = function(id) {
    modoEdicion = true;
    clienteActualId = id;
    const cliente = clientesGenerales.find(c => c.id === id);
    if (!cliente) return;

    document.querySelector('#modalCliente h2').textContent = 'Editar cliente';
    
    document.getElementById('inputNombre').value = cliente.nombre;
    document.getElementById('inputTelefono').value = cliente.telefono || '';
    document.getElementById('inputDireccion').value = cliente.direccion || '';

    abrirModal();
}

// --- 4. GUARDAR CAMBIOS (POST / PUT) ---
document.getElementById('formCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

    const payload = {
        nombre: document.getElementById('inputNombre').value,
        telefono: document.getElementById('inputTelefono').value,
        razon_social: document.getElementById('inputRazonSocial').value,
        direccion: document.getElementById('inputDireccion').value
    };

    let url = "http://localhost:3000/api/clientes";
    let method = "POST";

    if (modoEdicion) {
        url = `http://localhost:3000/api/clientes/${clienteActualId}`;
        method = "PUT";
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos suficientes para registrar o editar clientes."
            });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: modoEdicion ? 'Cliente actualizado' : 'Cliente registrado',
                timer: 1500,
                showConfirmButton: false
            });
            cerrarModal();
            await cargarClientes(token);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.Mensaje || 'Error al procesar la solicitud' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
    }
});

// --- 5. DESACTIVAR (DELETE LÓGICO) ---
window.eliminarCliente = async function(id) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar cliente?',
        text: "El cliente ya no aparecerá en el sistema, pero su historial de compras se conservará.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const token = localStorage.getItem('nexura_token');

        try {
            const res = await fetch(`http://localhost:3000/api/clientes/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.status === 403) {
                Swal.fire({
                    icon: "warning",
                    title: "Acceso Denegado",
                    text: "Solo el personal directivo puede eliminar registros de clientes."
                });
                return;
            }

            const data = await res.json();
            
            if (res.ok) {
                Swal.fire('¡Eliminado!', 'El cliente ha sido dado de baja.', 'success');
                await cargarClientes(token);
            } else {
                Swal.fire('Error', data.Mensaje || 'No se pudo eliminar al cliente', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de conexión al servidor.', 'error');
        }
    }
};

window.cerrarModalHistorial = function() {
    document.getElementById("modalHistorial").style.display = "none";
}

window.abrirHistorial = async function(clienteId, nombreCliente) {
    document.getElementById("nombreClienteHistorial").textContent = nombreCliente;
    const tbody = document.getElementById("tablaHistorialCuerpo");
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Cargando historial...</td></tr>";
    
    document.getElementById("modalHistorial").style.display = "flex";

    const token = localStorage.getItem('nexura_token');
    
    try {
        const res = await fetch(`http://localhost:3000/api/clientes/${clienteId}/historial`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
            const historial = await res.json();
            tbody.innerHTML = "";
            
            if (historial.length === 0) {
                tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Este cliente aún no tiene compras registradas.</td></tr>";
                return;
            }

            historial.forEach(mov => {
                const tr = document.createElement("tr");
                const fechaObj = new Date(mov.fecha_hora);
                const fechaStr = fechaObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
                
                // Calculamos el subtotal (Cantidad x Precio)
                const precio = parseFloat(mov.precio_venta || 0);

                tr.innerHTML = `
                    <td>${fechaStr}</td>
                    <td>${mov.folio}</td>
                    <td>${mov.sku}</td>
                    <td>${mov.producto}</td>
                    <td>${mov.numero_lote}</td> <!-- Nuevo dato -->
                    <td>${mov.cantidad}</td>
                    <td>$${precio.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:red;'>Error al cargar el historial.</td></tr>";
    }
}