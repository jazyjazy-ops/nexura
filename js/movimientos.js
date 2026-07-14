let movimientosGenerales = [];

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

    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });

    // Cargar datos iniciales
    await cargarMovimientos(token);
    await cargarSelects(token);

    // Buscador en tiempo real
    document.getElementById('inputBusqueda').addEventListener('input', filtrarMovimientos);
});

// --- 1. CARGAR HISTORIAL (KARDEX) ---
async function cargarMovimientos(token) {
    try {
        // Asegúrate de que esta URL coincida con la ruta que apunta a tu reporteController.js
        const res = await fetch("http://localhost:3000/api/movimientos", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }

        const movimientos = await res.json();
        movimientosGenerales = movimientos;
        renderizarTabla(movimientosGenerales);
    } catch (error) {
        console.error("Error al cargar movimientos:", error);
    }
}

function renderizarTabla(movimientos) {
    const tbody = document.getElementById('tablaMovimientos');
    tbody.innerHTML = '';

    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay movimientos registrados</td></tr>';
        return;
    }

    movimientos.forEach(mov => {
        // Formatear la fecha para que sea legible
        const fechaObj = new Date(mov.fecha_hora);
        const fechaFormateada = fechaObj.toLocaleString('es-MX', { 
            year: 'numeric', month: 'short', day: '2-digit', 
            hour: '2-digit', minute:'2-digit' 
        });

        // Colores según el tipo de movimiento
        const esEntrada = mov.tipo_movimiento.toLowerCase() === 'entrada';
        const claseEstado = esEntrada ? 'normal' : 'roja'; // normal = verde, roja = rojo (usando tu CSS)

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${mov.folio}</strong></td>
            <td><span class="estado ${claseEstado}">${mov.tipo_movimiento}</span></td>
            <td>[${mov.sku}] ${mov.producto}</td>
            <td>${mov.numero_lote}</td>
            <td>${esEntrada ? '+' : '-'}${mov.cantidad}</td>
            <td>${mov.cliente || 'N/A'}</td>
            <td>${mov.usuario}</td>
            <td>${fechaFormateada}</td>
        `;
        // Nota: Quitamos los botones de Editar/Eliminar. Por auditoría, un movimiento de inventario NUNCA se borra ni se edita, solo se compensa.
        tbody.appendChild(tr);
    });
}

// --- 2. LLENAR SELECTS DEL MODAL (PRODUCTOS Y CLIENTES) ---
async function cargarSelects(token) {
    const headers = { "Authorization": `Bearer ${token}` };
    try {
        const [resProductos, resClientes] = await Promise.all([
            fetch("http://localhost:3000/api/productos", { headers }),
            fetch("http://localhost:3000/api/clientes", { headers }) // Asumiendo que creaste esta ruta
        ]);

        const productos = await resProductos.json();
        const clientes = await resClientes.json();

        // Poblar Productos usando .appendChild para evitar bugs de renderizado
        const selectProducto = document.getElementById('selectProducto');
        selectProducto.innerHTML = '';
        selectProducto.appendChild(new Option('-- Selecciona el producto a despachar --', ''));
        
        productos.forEach(p => {
            // Solo mostramos productos activos
            if(p.estado) { 
                selectProducto.appendChild(new Option(`[${p.sku}] ${p.nombre}`, p.id.toString()));
            }
        });

        // Poblar Clientes
        const selectCliente = document.getElementById('selectCliente');
        selectCliente.innerHTML = '';
        selectCliente.appendChild(new Option('Ninguno (Uso interno / Merma)', ''));
        
        clientes.forEach(c => {
            if(c.estado === 'Activo') {
                selectCliente.appendChild(new Option(c.nombre_comercial, c.id.toString()));
            }
        });

    } catch (error) {
        console.error("Error al poblar catálogos:", error);
    }
}

// --- 3. CONFIGURAR MODAL ---
window.prepararNuevaSalida = function() {
    document.getElementById('formSalida').reset();
    abrirModal();
}

// --- 4. ENVIAR SALIDA (PEPS) AL BACKEND ---
document.getElementById('formSalida').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

    // Construimos el payload exactamente como lo espera loteController.registrarSalida
    const payload = {
        folio: document.getElementById('inputFolio').value,
        producto_id: parseInt(document.getElementById('selectProducto').value),
        cantidad_solicitada: parseInt(document.getElementById('inputCantidad').value),
        cliente_id: document.getElementById('selectCliente').value ? parseInt(document.getElementById('selectCliente').value) : null,
        comentarios: document.getElementById('inputComentarios').value
    };

    try {
        const res = await fetch("http://localhost:3000/api/lotes/salida", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Salida registrada',
                text: 'El inventario se ha descontado correctamente.',
                timer: 2000,
                showConfirmButton: false
            });
            cerrarModal();
            await cargarMovimientos(token); // Recargar la tabla
        } else {
            Swal.fire({ icon: 'error', title: 'Operación denegada', text: data.Mensaje || 'Error al procesar la salida' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
    }
});

// --- 5. FILTRADO EN TIEMPO REAL ---
function filtrarMovimientos(e) {
    const termino = e.target.value.toLowerCase();
    const filtrados = movimientosGenerales.filter(mov => {
        return (
            (mov.folio && mov.folio.toLowerCase().includes(termino)) ||
            (mov.producto && mov.producto.toLowerCase().includes(termino)) ||
            (mov.sku && mov.sku.toLowerCase().includes(termino)) ||
            (mov.usuario && mov.usuario.toLowerCase().includes(termino)) ||
            (mov.cliente && mov.cliente.toLowerCase().includes(termino))
        );
    });
    renderizarTabla(filtrados);
}