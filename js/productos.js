let productosGenerales = [];
let modoEdicion = false;
let productoActualId = null;
let rolUsuarioActual = null; 
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
    const areaABuscar = urlParams.get('area');
    const categoriaABuscar = urlParams.get('categoria');
    const filtroABuscar = urlParams.get('filtro');

    if (marcaABuscar) {
        const marcaDecodificada = decodeURIComponent(marcaABuscar);
        inputBusqueda.value = marcaDecodificada;
        filtrarProductos({ target: inputBusqueda });
    } else if (areaABuscar) {
        const areaDecodificada = decodeURIComponent(areaABuscar);
        inputBusqueda.value = areaDecodificada;
        filtrarProductos({ target: inputBusqueda });
    } else if (categoriaABuscar) {
        const categoriaDecodificada = decodeURIComponent(categoriaABuscar);
        inputBusqueda.value = categoriaDecodificada;
        filtrarProductos({ target: inputBusqueda });
    } 
    // NUEVO: Lógica de filtros de Stock desde el Dashboard
    else if (filtroABuscar === 'stock_bajo') {
        datosFiltradosActuales = productosGenerales.filter(p => p.stock_actual > 0 && p.stock_actual < p.stock_minimo);
        inputBusqueda.value = "Stock Bajo";
        paginaActual = 1;
        renderizarTablaPaginada();
    } else if (filtroABuscar === 'sin_stock') {
        datosFiltradosActuales = productosGenerales.filter(p => p.stock_actual <= 0);
        inputBusqueda.value = "Agotado";
        paginaActual = 1;
        renderizarTablaPaginada();
    }
    else if (filtroABuscar === 'normal') {
        datosFiltradosActuales = productosGenerales.filter(p => p.stock_actual <= 0);
        inputBusqueda.value = "Agotado";
        paginaActual = 1;
        renderizarTablaPaginada();
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
        const [resAreas, resCategorias, resMarcas, resEquipos] = await Promise.all([
            fetch("http://localhost:3000/api/areas", { headers }),
            fetch("http://localhost:3000/api/categorias", { headers }), 
            fetch("http://localhost:3000/api/marcas", { headers }),
            fetch("http://localhost:3000/api/equipos", { headers })
        ]);

        const areas = await resAreas.json();
        const categorias = await resCategorias.json(); 
        const marcas = await resMarcas.json();
        const equipos = await resEquipos.json();

        const selectArea = document.getElementById('selectArea');
        selectArea.innerHTML = '<option value="">-- Selecciona Área --</option>';
        areas.forEach(a => selectArea.innerHTML += `<option value="${a.id}">${a.nombre}</option>`);

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
        categoria_id: document.getElementById('selectCategoria').value ? parseInt(document.getElementById('selectCategoria').value) : null,
        marca_id: document.getElementById('selectMarca').value ? parseInt(document.getElementById('selectMarca').value) : null,
        equipo_id: document.getElementById('selectEquipo').value ? parseInt(document.getElementById('selectEquipo').value) : null,
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
            categoria_id: prod.categoria_id,
            marca_id: prod.marca_id,
            equipo_id: prod.equipo_id,
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
    
    // Si el usuario escribe manualmente, se limpia la búsqueda de "Stock Bajo / Sin Stock" y se busca normalmente
    if (termino === "filtrando: stock bajo" || termino === "filtrando: sin stock") {
        return; 
    }

    datosFiltradosActuales = productosGenerales.filter(p => {
        return (
            p.nombre.toLowerCase().includes(termino) ||
            p.sku.toLowerCase().includes(termino) ||
            (p.area_nombre && p.area_nombre.toLowerCase().includes(termino)) ||
            (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(termino)) ||
            (p.marca_nombre && p.marca_nombre.toLowerCase().includes(termino))
        );
    });
    
    paginaActual = 1; 
    renderizarTablaPaginada();
}

// --- 7. RENDERIZADO DE LA TABLA ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = '';

    // Recuerda agregar las columnas <td> adicionales a tu colspan si dice "No se encontraron productos"
    if (datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;">No se encontraron productos</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const productosPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero', 'Gerencia de Ventas', 'Jefe de Ingenieria'];
    const tienePermisosEdicion = !rolesSinPermiso.includes(rolUsuarioActual);

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

        // NUEVO: Cálculos matemáticos del Faltante
        const stockActual = parseFloat(p.stock_actual || 0); 
        const stockMinimo = parseFloat(p.stock_minimo || 1);
        
        let faltante = 0;
        if (stockActual < stockMinimo) {
            faltante = stockMinimo - stockActual;
        }

        let diseñoFaltante = "";
        if (faltante > 0) {
            diseñoFaltante = `<span style="color: #e74c3c; font-weight: bold;">+${faltante}</span>`; // Rojo si falta
        } else {
            diseñoFaltante = `<span style="color: #2ecc71;">0</span>`; // Verde si está bien
        }

        tr.innerHTML = `
            <td>${p.sku}</td>
            <td>${p.nombre}</td>
            <td>${p.presentacion || 'N/A'}</td>
            <td>${p.area_nombre || 'Sin área'}</td>
            <td>${p.categoria_nombre || 'Sin categoría'}</td>
            <td>${p.marca_nombre || 'Sin marca'}</td>
            <td>${p.equipo_nombre || 'General'}</td>
            <td>${stockMinimo}</td>
            <td><strong>${stockActual}</strong></td> <!-- NUEVO: Muestra la suma del stock -->
            <td>${diseñoFaltante}</td> <!-- NUEVO: Muestra lo que hay que pedir -->
            <td><span class="estado ${p.estado ? 'normal' : 'roja'}">${p.estado ? 'Activo' : 'Inactivo'}</span></td>
            <td>${botonesAccion}</td>
        `;
        tbody.appendChild(tr);
    });

    renderizarControlesPaginacion(datosFiltradosActuales.length);
}

// --- 8. CONTROLES DE PAGINACIÓN ---
function renderizarControlesPaginacion(totalRegistros) {
    const contenedor = document.getElementById('controlesPaginacion');
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