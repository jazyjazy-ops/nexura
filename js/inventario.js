let lotesGenerales = [];
let modoEdicion = false;
let loteActualId = null;
let rolUsuarioActual = null; // Variable global para guardar el rol

// --- VARIABLES DE PAGINACIÓN ---
let paginaActual = 1;
const registrosPorPagina = 10;
let datosFiltradosActuales = [];

const API_URL = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("nexura_token");
    const usuarioStr = localStorage.getItem("nexura_usuario");

    if (!token || !usuarioStr) {
        window.location.href = "login.html";
        return;
    }

    const usuario = JSON.parse(usuarioStr);

    document.getElementById("nombreUsuario").textContent = usuario.nombre;

    const rolDOM = document.getElementById("rolUsuario");
    if (rolDOM) {
        rolDOM.textContent = usuario.departamento || "Administración";
    }

    const btnCerrar = document.getElementById("btnCerrarSesion");

    if (btnCerrar) {
        btnCerrar.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("nexura_token");
            localStorage.removeItem("nexura_usuario");
            window.location.href = "login.html";
        });
    }

    rolUsuarioActual = usuario.departamento || usuario.rol; 

    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero'];
    if (rolesSinPermiso.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector("#btnAgregarEntrada");
        const btnSalida = document.querySelector('#btnRegistrarSalida');
        if (btnAgregar && btnSalida){
            btnAgregar.style.display = 'none';
            btnSalida.style.display = 'none';
        } 
    }

    document
        .getElementById("btnAgregarEntrada")
        .addEventListener("click", prepararNuevoLote);

    document
        .getElementById("btnRegistrarSalida")
        .addEventListener("click", () => {
            document.getElementById("formSalida").reset();
            abrirModalSalida();
        });

    document
        .getElementById("inputBusqueda")
        .addEventListener("input", filtrarInventario);

    await cargarInventario(token);
    await cargarSelects(token);
});

async function cargarInventario(token) {
    try {
        const res = await fetch(`${API_URL}/lotes`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            localStorage.removeItem("nexura_token");
            localStorage.removeItem("nexura_usuario");
            window.location.href = "login.html";
            return;
        }

        const lotes = await res.json();

        lotesGenerales = lotes;
        
        // Inicializamos los datos filtrados con todos los lotes
        datosFiltradosActuales = [...lotesGenerales];

        // Llamamos a la nueva función de paginación
        renderizarTablaPaginada();

    } catch (error) {
        console.error("Error al cargar inventario:", error);

        Swal.fire({
            icon: "error",
            title: "Error de conexión",
            text: "No se pudo cargar el inventario."
        });
    }
}

// --- NUEVA FUNCIÓN: RENDERIZAR TABLA PAGINADA ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById("tablaInventario");
    tbody.innerHTML = "";

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No se encontraron registros
                </td>
            </tr>
        `;
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin para cortar el arreglo
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const lotesPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero'];
    const tienePermisosEdicion = !rolesSinPermiso.includes(rolUsuarioActual);

    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];

    // Iteramos SOLO sobre los lotes de la página actual
    lotesPagina.forEach((lote) => {
        let claseEstado = "normal";
        let estadoMostrar = lote.estado;

        let botonesAccion = "";
        if (tienePermisosEdicion) {
            botonesAccion = `
                <button class="btn-editar" onclick="prepararEdicion(${lote.id})">Editar</button>
                <button class="btn-eliminar" onclick="eliminarLote(${lote.id})">Eliminar</button>
            `;
        } else {
            botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;
        }

        const fechaCaducidad = lote.fecha_caducidad
            ? lote.fecha_caducidad.split("T")[0]
            : "Sin fecha";

        if (Number(lote.cantidad_disponible) === 0 || lote.estado === "Agotado") {
            claseEstado = "roja";
            estadoMostrar = "Agotado";
        } else if (fechaCaducidad !== "Sin fecha" && fechaCaducidad < hoyStr) {
            claseEstado = "negra";
            estadoMostrar = "Caducado";
        } else if (Number(lote.cantidad_disponible) <= Number(lote.stock_minimo)) {
            claseEstado = "roja";
            estadoMostrar = "Stock bajo";
        } else if (Number(lote.cantidad_disponible) <= Number(lote.stock_minimo) + 3) {
            claseEstado = "amarilla";
            estadoMostrar = "Advertencia";
        }

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${lote.numero_lote}</td>
            <td>[${lote.producto_sku}] ${lote.producto_nombre}</td>
            <td>${lote.cantidad_disponible}</td>
            <td>${fechaCaducidad}</td>
            <td>
                <span class="estado ${claseEstado}">
                    ${estadoMostrar}
                </span>
            </td>
            <td>
                ${botonesAccion}
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Dibujamos los botones de paginación
    renderizarControlesPaginacion(datosFiltradosActuales.length);
}

// --- NUEVA FUNCIÓN: CONTROLES DE PAGINACIÓN ---
function renderizarControlesPaginacion(totalRegistros) {
    const contenedor = document.getElementById('controlesPaginacion');
    if (!contenedor) return; // Evita errores si no se ha agregado el div al HTML

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

function filtrarInventario() {
    const textoBuscado = document
        .getElementById("inputBusqueda")
        .value
        .toLowerCase();

    // Actualizamos el arreglo de datos filtrados
    datosFiltradosActuales = lotesGenerales.filter((lote) => {
        return (
            lote.producto_nombre.toLowerCase().includes(textoBuscado) ||
            lote.producto_sku.toLowerCase().includes(textoBuscado) ||
            lote.numero_lote.toLowerCase().includes(textoBuscado) ||
            lote.estado.toLowerCase().includes(textoBuscado)
        );
    });

    // Reiniciamos a la página 1 cada vez que se busca algo
    paginaActual = 1;
    renderizarTablaPaginada();
}

async function cargarSelects(token) {
    try {
        const headers = { Authorization: `Bearer ${token}` };
        
        // Hacemos ambas peticiones al mismo tiempo para mayor velocidad
        const [resProductos, resClientes] = await Promise.all([
            fetch(`${API_URL}/productos`, { headers }),
            fetch(`${API_URL}/clientes`, { headers })
        ]);

        const productos = await resProductos.json();
        const clientes = await resClientes.json();

        // 1. Llenar Productos
        const selectEntrada = document.getElementById("selectProducto");
        const selectSalida = document.getElementById("selectProductoSalida");

        selectEntrada.innerHTML = `<option value="">Seleccione un producto</option>`;
        selectSalida.innerHTML = `<option value="">Seleccione un producto</option>`;

        productos.forEach((producto) => {
            // Solo mostramos productos activos
            if (producto.estado) {
                const texto = `[${producto.sku}] ${producto.nombre}`;
                selectEntrada.appendChild(new Option(texto, producto.id));
                selectSalida.appendChild(new Option(texto, producto.id));
            }
        });

        // 2. Llenar Clientes
        const selectCliente = document.getElementById("selectClienteSalida");
        if (selectCliente) {
            selectCliente.innerHTML = `<option value="">Ninguno (Uso interno / Merma)</option>`;
            clientes.forEach((cliente) => {
                if (cliente.estado !== 'Inactivo') {
                    // Mostramos nombre_comercial si existe, si no, el nombre normal
                    const nombreMostrar = cliente.nombre_comercial || cliente.nombre;
                    selectCliente.appendChild(new Option(nombreMostrar, cliente.id));
                }
            });
        }

    } catch (error) {
        console.error("Error al cargar catálogos:", error);
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudieron cargar los catálogos para los formularios."
        });
    }
}

function prepararNuevoLote() {
    modoEdicion = false;
    loteActualId = null;

    document.querySelector("#modalProducto h2").textContent =
        "Registrar Entrada de Inventario";

    document.getElementById("formAgregarLote").reset();

    document.getElementById("inputFolio").disabled = false;
    document.getElementById("inputFolio").required = true;

    abrirModal();
}

window.prepararEdicion = function (id) {
    modoEdicion = true;
    loteActualId = id;

    const lote = lotesGenerales.find((l) => l.id === id);

    if (!lote) {
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se encontró el lote seleccionado."
        });
        return;
    }

    document.querySelector("#modalProducto h2").textContent =
        "Actualizar Lote";

    document.getElementById("selectProducto").value = lote.producto_id;
    document.getElementById("inputLote").value = lote.numero_lote;
    document.getElementById("inputCantidad").value = lote.cantidad_disponible;
    document.getElementById("inputCaducidad").value =
        lote.fecha_caducidad.split("T")[0];

    document.getElementById("inputFolio").value = "N/A";
    document.getElementById("inputFolio").disabled = true;
    document.getElementById("inputFolio").required = false;

    abrirModal();
};

document.getElementById("formAgregarLote").addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("nexura_token");

    let url = `${API_URL}/lotes`;
    let metodo = "POST";
    let payload = {};

    const producto_id = document.getElementById("selectProducto").value;
    const numero_lote = document.getElementById("inputLote").value;
    const fecha_caducidad = document.getElementById("inputCaducidad").value;
    const cantidad = parseInt(document.getElementById("inputCantidad").value);

    if (modoEdicion) {
        const loteAnterior = lotesGenerales.find((l) => l.id === loteActualId);
        url = `${API_URL}/lotes/${loteActualId}`;
        metodo = "PUT";
        payload = {
            producto_id,
            numero_lote,
            fecha_caducidad,
            cantidad_inicial: loteAnterior.cantidad_inicial,
            cantidad_disponible: cantidad,
            estado: cantidad > 0 ? "Activo" : "Agotado"
        };
    } else {
        const folio = document.getElementById("inputFolio").value;
        payload = {
            producto_id,
            numero_lote,
            fecha_caducidad,
            cantidad_inicial: cantidad,
            folio,
            comentarios: "Entrada manual desde inventario"
        };
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos para modificar el inventario."
            });
            return; 
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: "success",
                title: modoEdicion ? "Lote actualizado" : "Entrada registrada",
                text: data.Mensaje,
                timer: 1500,
                showConfirmButton: false
            });
            cerrarModal();
            document.getElementById("formAgregarLote").reset();
            await cargarInventario(token);
        } else {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: data.Mensaje || "No se pudo guardar el lote."
            });
        }
    } catch (error) {
        console.error("Error al guardar lote:", error);
        Swal.fire({
            icon: "error",
            title: "Error de conexión",
            text: "No se pudo contactar al servidor."
        });
    }
});

document.getElementById("formSalida").addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("nexura_token");

    const cliente = document.getElementById("selectClienteSalida").value;

    const payload = {
        producto_id: document.getElementById("selectProductoSalida").value,
        cantidad_solicitada: parseInt(
            document.getElementById("inputCantidadSalida").value
        ),
        precio_total: parseInt(
            document.getElementById("inputPrecio").value
        ),
        folio: document.getElementById("inputFolioSalida").value,
        cliente_id: cliente ? parseInt(cliente) : null,
        comentarios:
            document.getElementById("inputComentariosSalida").value ||
            "Salida de mercancía"
    };

    try {
        const res = await fetch(`${API_URL}/lotes/salida`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: "success",
                title: "Salida registrada",
                text: data.Mensaje,
                timer: 1500,
                showConfirmButton: false
            });

            cerrarModalSalida();
            document.getElementById("formSalida").reset();

            await cargarInventario(token);

        } else {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: data.Mensaje || "No se pudo registrar la salida."
            });
        }

    } catch (error) {
        console.error("Error al registrar salida:", error);

        Swal.fire({
            icon: "error",
            title: "Error de conexión",
            text: "No se pudo contactar al servidor."
        });
    }
});

window.eliminarLote = async function (id) {
    const confirmacion = await Swal.fire({
        title: "¿Eliminar lote?",
        text: "Si eliminas este lote, desaparecerá del inventario.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacion.isConfirmed) return;

    const token = localStorage.getItem("nexura_token");

    try {
        const res = await fetch(`${API_URL}/lotes/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos para eliminar registros históricos."
            });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: "success",
                title: "Lote eliminado",
                text: data.Mensaje,
                timer: 1500,
                showConfirmButton: false
            });
            await cargarInventario(token);
        } else {
            Swal.fire({
                icon: res.status === 409 ? "warning" : "error",
                title: res.status === 409 ? "No se puede eliminar" : "Error",
                text: data.Mensaje || "No se pudo eliminar el lote."
            });
        }
    } catch (error) {
        console.error("Error al eliminar lote:", error);
        Swal.fire({
            icon: "error",
            title: "Error de conexión",
            text: "No se pudo contactar al servidor."
        });
    }
};