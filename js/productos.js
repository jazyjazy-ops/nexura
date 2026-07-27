let productosGenerales = [];
let modoEdicion = false;
let productoActualId = null;
let rolUsuarioActual = null; // Variable global para guardar el rol
let paginaActual = 1;
const registrosPorPagina = 10; // Puedes cambiar esto a 5 o 15
let datosFiltradosActuales = []; // Guardará los datos que se están mostrando actualmente

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
    
    // Guardamos el rol para validaciones en el Frontend
    rolUsuarioActual = usuario.departamento || usuario.rol;

    // Ocultar botón de agregar si el rol no tiene permisos administrativos
    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero', 'Gerencia de Ventas', 'Jefe de Ingenieria'];
    if (rolesSinPermiso.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });

    await cargarProductos(token);
    await cargarSelects(token);

    const inputBusqueda = document.getElementById('inputBusqueda');
    inputBusqueda.addEventListener('input', filtrarProductos);

    const urlParams = new URLSearchParams(window.location.search);
    const marcaABuscar = urlParams.get('marca');

    if (marcaABuscar) {
        const marcaDecodificada = decodeURIComponent(marcaABuscar);
        inputBusqueda.value = marcaDecodificada;
        filtrarProductos({ target: inputBusqueda });
    }
});

// --- 1. CARGAR TABLA (GET) ---
async function cargarProductos(token) {
    try {
        const res = await fetch("http://localhost:3000/api/productos", {
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
                text: "No tienes permisos para visualizar el catálogo de productos."
            });
            return;
        }

        productosGenerales = await res.json();
        datosFiltradosActuales = [...productosGenerales]; 
        renderizarTablaPaginada();
    } catch (error) {
        console.error("Error al cargar productos:", error);
    }
}

// --- 2. LLENAR SELECTS DEL MODAL ---
async function cargarSelects(token) {
    const headers = { "Authorization": `Bearer ${token}` };
    try {
        // Añadimos el fetch a /api/categorias
        const [resAreas, resCategorias, resMarcas, resEquipos] = await Promise.all([
            fetch("http://localhost:3000/api/areas", { headers }),
            fetch("http://localhost:3000/api/categorias", { headers }), // NUEVO
            fetch("http://localhost:3000/api/marcas", { headers }),
            fetch("http://localhost:3000/api/equipos", { headers })
        ]);

        const areas = await resAreas.json();
        const categorias = await resCategorias.json(); // NUEVO
        const marcas = await resMarcas.json();
        const equipos = await resEquipos.json();

        const selectArea = document.getElementById('selectArea');
        selectArea.innerHTML = '<option value="">-- Selecciona Área --</option>';
        areas.forEach(a => selectArea.innerHTML += `<option value="${a.id}">${a.nombre}</option>`);

        // NUEVO SELECT DE CATEGORÍAS
        const selectCategoria = document.getElementById('selectCategoria');
        selectCategoria.innerHTML = '<option value="">-- Selecciona Categoría (Opcional) --</option>';
        categorias.forEach(c => selectCategoria.innerHTML += `<option value="${c.id}">${c.nombre}</option>`);

        const selectMarca = document.getElementById('selectMarca');
        selectMarca.innerHTML = '<option value="">-- Selecciona Marca --</option>';
        marcas.forEach(m => selectMarca.innerHTML += `<option value="${m.id}">${m.nombre}</option>`);

        const selectEquipo = document.getElementById('selectEquipo');
        selectEquipo.innerHTML = '<option value="">Ninguno (Uso general)</option>';
        equipos.forEach(e => selectEquipo.innerHTML += `<option value="${e.id}">${e.nombre} (${e.area_nombre})</option>`);

    } catch (error) {
        console.error("Error al poblar selectores:", error);
    }
}

// --- 3. CONFIGURAR ACCIONES DEL MODAL ---
window.prepararNuevoProducto = function() {
    modoEdicion = false;
    productoActualId = null;
    document.querySelector('#modalProducto h2').textContent = 'Agregar producto';
    document.getElementById('formProducto').reset();
    
    document.getElementById('selectEstado').value = "1"; 
    
    abrirModal();
}

window.prepararEdicion = function(id) {
    modoEdicion = true;
    productoActualId = id;
    const prod = productosGenerales.find(p => p.id === id);
    if (!prod) return;

    document.querySelector('#modalProducto h2').textContent = 'Editar producto';
    
    document.getElementById('inputSku').value = prod.sku;
    document.getElementById('inputNombre').value = prod.nombre;
    document.getElementById('inputPresentacion').value = prod.presentacion || '';
    document.getElementById('inputDescripcion').value = prod.descripcion || '';
    document.getElementById('selectArea').value = prod.area_id || '';
    document.getElementById('selectCategoria').value = prod.categoria_id || '';
    document.getElementById('selectMarca').value = prod.marca_id || '';
    document.getElementById('selectEquipo').value = prod.equipo_id || '';
    document.getElementById('inputPrecio').value = prod.precio;
    document.getElementById('inputStockMinimo').value = prod.stock_minimo;
    
    document.getElementById('selectEstado').value = prod.estado ? "1" : "0";

    abrirModal();
}

// --- 4. GUARDAR CAMBIOS (POST / PUT) ---
document.getElementById('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

    const payload = {
        sku: document.getElementById('inputSku').value,
        nombre: document.getElementById('inputNombre').value,
        presentacion: document.getElementById('inputPresentacion').value,
        descripcion: document.getElementById('inputDescripcion').value,
        area_id: parseInt(document.getElementById('selectArea').value),
        categoria_id: document.getElementById('selectCategoria').value ? parseInt(document.getElementById('selectCategoria').value) : null, // NUEVO
        marca_id: document.getElementById('selectMarca').value ? parseInt(document.getElementById('selectMarca').value) : null,
        equipo_id: document.getElementById('selectEquipo').value ? parseInt(document.getElementById('selectEquipo').value) : null,
        precio: parseFloat(document.getElementById('inputPrecio').value),
        stock_minimo: parseInt(document.getElementById('inputStockMinimo').value),
        estado: parseInt(document.getElementById('selectEstado').value) 
    };

    let url = "http://localhost:3000/api/productos";
    let method = "POST";

    if (modoEdicion) {
        url = `http://localhost:3000/api/productos/${productoActualId}`;
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

        // VALIDACIÓN: Interceptar el 403 antes de parsear JSON
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos suficientes para crear o modificar productos."
            });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: modoEdicion ? 'Producto actualizado' : 'Producto creado',
                timer: 1500,
                showConfirmButton: false
            });
            cerrarModal();
            await cargarProductos(token);
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.Mensaje || 'Error al procesar la solicitud' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo conectar con el servidor.' });
    }
});

// --- 5. ELIMINAR (DELETE / DESACTIVAR) ---
window.eliminarProducto = async function(id) {
    const confirmacion = await Swal.fire({
        title: '¿Desactivar producto?',
        text: "El producto ya no aparecerá activo en el sistema, pero conservará su historial.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const token = localStorage.getItem('nexura_token');
        const prod = productosGenerales.find(p => p.id === id);
        
        const payload = {
            sku: prod.sku,
            nombre: prod.nombre,
            presentacion: prod.presentacion,
            descripcion: prod.descripcion,
            area_id: prod.area_id,
            categoria_id: prod.categoria_id, // NUEVO
            marca_id: prod.marca_id,
            equipo_id: prod.equipo_id,
            precio: prod.precio,
            stock_minimo: prod.stock_minimo,
            estado: 0 
        };

        try {
            const res = await fetch(`http://localhost:3000/api/productos/${id}`, {
                method: 'PUT',
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
                    text: "No tienes permisos suficientes para desactivar productos."
                });
                return;
            }

            const data = await res.json();
            
            if (res.ok) {
                Swal.fire('¡Desactivado!', 'El producto ahora está inactivo.', 'success');
                await cargarProductos(token);
            } else {
                Swal.fire('Error', data.Mensaje || 'No se pudo desactivar', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de conexión al servidor.', 'error');
        }
    }
}

// --- 6. FILTRADO EN TIEMPO REAL ---
function filtrarProductos(e) {
    const termino = e.target.value.toLowerCase();
    
    // Actualizamos el arreglo de datos filtrados
    datosFiltradosActuales = productosGenerales.filter(p => {
        return (
            p.nombre.toLowerCase().includes(termino) ||
            p.sku.toLowerCase().includes(termino) ||
            (p.area_nombre && p.area_nombre.toLowerCase().includes(termino)) ||
            (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(termino)) ||
            (p.marca_nombre && p.marca_nombre.toLowerCase().includes(termino))
        );
    });
    
    // Reiniciamos a la página 1 cada vez que se busca algo
    paginaActual = 1; 
    renderizarTablaPaginada();
}

function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = '';

    if (datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No se encontraron productos</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin para cortar el arreglo
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const productosPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero', 'Gerencia de Ventas', 'Jefe de Ingenieria'];
    const tienePermisosEdicion = !rolesSinPermiso.includes(rolUsuarioActual);

    // Iteramos SOLO sobre los productos de la página actual
    productosPagina.forEach(p => {
        const tr = document.createElement('tr');
        
        let botonesAccion = "";
        if (tienePermisosEdicion) {
            botonesAccion = `
                <button class="btn-editar" onclick="prepararEdicion(${p.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>
                <button class="btn-eliminar" onclick="eliminarProducto(${p.id})">Eliminar</button>
            `;
        } else {
            botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;
        }

        tr.innerHTML = `
            <td>${p.sku}</td>
            <td>${p.nombre}</td>
            <td>${p.presentacion || 'N/A'}</td>
            <td>${p.area_nombre || 'Sin área'}</td>
            <td>${p.categoria_nombre || 'Sin categoría'}</td>
            <td>${p.marca_nombre || 'Sin marca'}</td>
            <td>${p.equipo_nombre || 'General'}</td>
            <td>${p.stock_minimo}</td>
            <td>$${Number(p.precio).toFixed(2)}</td>
            <td><span class="estado ${p.estado ? 'normal' : 'roja'}">${p.estado ? 'Activo' : 'Inactivo'}</span></td>
            <td>${botonesAccion}</td>
        `;
        tbody.appendChild(tr);
    });

    // Dibujamos los botones de paginación
    renderizarControlesPaginacion(datosFiltradosActuales.length);
}

// 5. NUEVA FUNCIÓN: Controles de Paginación
function renderizarControlesPaginacion(totalRegistros) {
    const contenedor = document.getElementById('controlesPaginacion');
    contenedor.innerHTML = '';

    if (totalRegistros <= registrosPorPagina) return; // No mostrar si no hay suficientes datos

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