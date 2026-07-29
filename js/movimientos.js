let movimientosGenerales = [];
let rolUsuarioActual = null; // Variable global para guardar el rol

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
    
    // Guardamos el rol globalmente
    rolUsuarioActual = usuario.departamento || usuario.rol;

    // Ocultamos el botón de salida para los roles comerciales o ajenos al almacén
    const rolesPermitidosSalida = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Jefe de Almacen'];
    if (!rolesPermitidosSalida.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

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
        const res = await fetch("http://localhost:3000/api/movimientos", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }

        // VALIDACIÓN: Interceptar el 403
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos para visualizar el historial de movimientos."
            });
            return;
        }

        const movimientos = await res.json();
        movimientosGenerales = movimientos;
        
        // Inicializamos los datos filtrados
        datosFiltradosActuales = [...movimientosGenerales];
        
        // Llamamos a la tabla paginada
        renderizarTablaPaginada();
    } catch (error) {
        console.error("Error al cargar movimientos:", error);
    }
}

// --- 2. RENDERIZAR TABLA PAGINADA ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaMovimientos');
    tbody.innerHTML = '';

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay movimientos registrados</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin para cortar el arreglo
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const movimientosPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    // Iteramos SOLO sobre los movimientos de la página actual
    movimientosPagina.forEach(mov => {
        // Formatear la fecha para que sea legible
        const fechaObj = new Date(mov.fecha_hora);
        const fechaFormateada = fechaObj.toLocaleString('es-MX', { 
            year: 'numeric', month: 'short', day: '2-digit', 
            hour: '2-digit', minute:'2-digit' 
        });

        const esEntrada = mov.tipo_movimiento.toLowerCase() === 'entrada';
        const claseEstado = esEntrada ? 'normal' : 'roja';
        
        const precioVenta = mov.precio_venta || mov.precio || 0; 
        const textoPrecio = esEntrada ? 'N/A' : `$${parseFloat(precioVenta).toFixed(2)}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${mov.folio}</strong></td>
            <td><span class="estado ${claseEstado}">${mov.tipo_movimiento}</span></td>
            <td>[${mov.sku}] ${mov.producto}</td>
            <td>${mov.numero_lote}</td>
            <td>${esEntrada ? '+' : '-'}${mov.cantidad}</td>
            <td>${textoPrecio}</td>
            <td>${mov.cliente || 'N/A'}</td>
            <td>${mov.usuario}</td>
            <td>${fechaFormateada}</td>
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
function filtrarMovimientos(e) {
    const termino = e.target.value.toLowerCase();
    
    // Actualizamos los datos filtrados
    datosFiltradosActuales = movimientosGenerales.filter(mov => {
        return (
            (mov.folio && mov.folio.toLowerCase().includes(termino)) ||
            (mov.producto && mov.producto.toLowerCase().includes(termino)) ||
            (mov.sku && mov.sku.toLowerCase().includes(termino)) ||
            (mov.usuario && mov.usuario.toLowerCase().includes(termino)) ||
            (mov.cliente && mov.cliente.toLowerCase().includes(termino))
        );
    });
    
    // Reiniciamos a la página 1 al filtrar
    paginaActual = 1;
    renderizarTablaPaginada();
}

// --- 3. LLENAR SELECTS DEL MODAL (PRODUCTOS Y CLIENTES) ---
async function cargarSelects(token) {
    const headers = { "Authorization": `Bearer ${token}` };
    try {
        const [resProductos, resClientes] = await Promise.all([
            fetch("http://localhost:3000/api/productos", { headers }),
            fetch("http://localhost:3000/api/clientes", { headers })
        ]);

        // Evitar que el JSON se rompa si el backend denegó alguna de las dos listas
        if (resProductos.status === 403 || resClientes.status === 403) {
            console.warn("Acceso denegado a catálogos para poblar los selectores.");
            return;
        }

        const productos = await resProductos.json();
        const clientes = await resClientes.json();

        // Poblar Productos usando .appendChild
        const selectProducto = document.getElementById('selectProducto');
        selectProducto.innerHTML = '';
        selectProducto.appendChild(new Option('-- Selecciona el producto a despachar --', ''));
        
        productos.forEach(p => {
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

// --- 4. CONFIGURAR MODAL ---
window.prepararNuevaSalida = function() {
    document.getElementById('formSalida').reset();
    abrirModal();
}

// --- 5. ENVIAR SALIDA (PEPS) AL BACKEND ---
document.getElementById('formSalida').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

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

        // VALIDACIÓN: Interceptar el 403 antes de parsear JSON
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "Tu perfil de usuario no está autorizado para despachar inventario."
            });
            return;
        }

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
            await cargarMovimientos(token);
        } else {
            Swal.fire({ icon: 'error', title: 'Operación denegada', text: data.Mensaje || 'Error al procesar la salida' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
    }
});