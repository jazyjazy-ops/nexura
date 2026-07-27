let marcasGenerales = [];
let modoEdicion = false;
let marcaActualId = null;
let rolUsuarioActual = null; // Variable global para guardar el rol

// --- VARIABLES DE PAGINACIÓN ---
let paginaActual = 1;
const registrosPorPagina = 10;
let datosFiltradosActuales = [];

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

    rolUsuarioActual = usuario.departamento || usuario.rol; 

    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero'];
    if (rolesSinPermiso.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

    document.getElementById("inputBusqueda").addEventListener("input", filtrarMarcas);

    await cargarMarcas(token);
});

async function cargarMarcas(token) {
    try {
        const res = await fetch("http://localhost:3000/api/marcas", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }

        // Validación de permisos para lectura
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos para visualizar el catálogo de marcas."
            });
            return;
        }

        const marcas = await res.json();
        marcasGenerales = marcas;
        
        // Inicializamos los datos filtrados con todas las marcas
        datosFiltradosActuales = [...marcasGenerales];

        // Llamamos a la nueva función paginada
        renderizarTablaPaginada();

    } catch (error) {
        console.error("Error al cargar marcas:", error);
    }
}

// --- NUEVA FUNCIÓN: RENDERIZAR TABLA PAGINADA ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById("tablaMarcas");
    tbody.innerHTML = "";

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;">No se encontraron marcas</td>
            </tr>
        `;
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin para cortar el arreglo
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const marcasPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    // 1. Definimos los roles que NO tienen permiso de edición
    const rolesSinPermiso = ['Operador', 'Vendedor', 'Ingeniero'];
    
    // 2. Evaluamos si el rol actual global TIENE permiso
    const tienePermisosEdicion = !rolesSinPermiso.includes(rolUsuarioActual);

    // Iteramos SOLO sobre las marcas de la página actual
    marcasPagina.forEach(marca => {
        const tr = document.createElement("tr");

        // 3. Construimos los botones de acción dinámicamente
        let botonesAccion = "";
        if (tienePermisosEdicion) {
            botonesAccion = `
                <button class="btn-editar" onclick="prepararEdicion(${marca.id})">Editar</button>
                <button class="btn-eliminar" onclick="eliminarMarca(${marca.id})">Eliminar</button>
            `;
        } else {
            botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;
        }

        tr.innerHTML = `
            <td>${marca.id}</td>
            <td>${marca.nombre}</td>
            <td>${marca.descripcion || "Sin descripción"}</td>
            <td>
                <button class="btn-consultar" onclick="consultarProductos('${encodeURIComponent(marca.nombre)}')">Consultar productos</button>
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
function filtrarMarcas() {
    const textoBuscado = document
        .getElementById("inputBusqueda")
        .value
        .toLowerCase();

    // Actualizamos el arreglo de datos filtrados
    datosFiltradosActuales = marcasGenerales.filter((marca) => {
        return (
            marca.nombre.toLowerCase().includes(textoBuscado) ||
            String(marca.id).includes(textoBuscado)
        );
    });

    // Reiniciamos a la página 1 cada vez que se busca algo
    paginaActual = 1;
    renderizarTablaPaginada();
}

function prepararNuevaMarca() {
    modoEdicion = false;
    marcaActualId = null;

    document.querySelector("#modalMarca h2").textContent = "Agregar marca";
    document.getElementById("formMarca").reset();

    abrirModal();
}

document.querySelector(".btn-agregar").onclick = prepararNuevaMarca;

window.prepararEdicion = function(id) {
    modoEdicion = true;
    marcaActualId = id;

    const marca = marcasGenerales.find(m => m.id === id);

    if (!marca) return;

    document.querySelector("#modalMarca h2").textContent = "Editar marca";
    document.getElementById("inputNombre").value = marca.nombre;
    document.getElementById("inputDescripcion").value = marca.descripcion || "";

    abrirModal();
};

document.getElementById("formMarca").addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("nexura_token");

    const nombre = document.getElementById("inputNombre").value;
    const descripcion = document.getElementById("inputDescripcion").value;

    let url = "http://localhost:3000/api/marcas";
    let metodo = "POST";

    if (modoEdicion) {
        url = `http://localhost:3000/api/marcas/${marcaActualId}`;
        metodo = "PUT";
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nombre,
                descripcion,
                imagen: null
            })
        });

        // VALIDACIÓN: Interceptar el 403 antes de parsear JSON
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "No tienes permisos suficientes para guardar o modificar marcas."
            });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: "success",
                title: modoEdicion ? "Marca actualizada" : "Marca agregada",
                timer: 1500,
                showConfirmButton: false
            });

            cerrarModal();
            await cargarMarcas(token);
        } else {
            Swal.fire("Error", data.Mensaje || "No se pudo guardar", "error");
        }

    } catch (error) {
        Swal.fire("Error", "No se pudo conectar con el servidor", "error");
    }
});

window.eliminarMarca = async function(id) {
    const confirmacion = await Swal.fire({
        title: "¿Eliminar marca?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacion.isConfirmed) return;

    const token = localStorage.getItem("nexura_token");

    try {
        const res = await fetch(`http://localhost:3000/api/marcas/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        // VALIDACIÓN: Interceptar el 403 antes de parsear JSON
        if (res.status === 403) {
            Swal.fire({
                icon: "warning",
                title: "Acceso Denegado",
                text: "Solo el personal directivo o de sistemas puede eliminar marcas."
            });
            return;
        }

        const data = await res.json();

        if (res.ok) {
            Swal.fire("Eliminada", "La marca fue eliminada correctamente", "success");
            await cargarMarcas(token);
        } else {
            Swal.fire("Error", data.Mensaje || "No se pudo eliminar", "error");
        }

    } catch (error) {
        Swal.fire("Error", "No se pudo conectar con el servidor", "error");
    }
};

window.consultarProductos = function(nombreMarca) {
    window.location.href = `productos.html?marca=${nombreMarca}`;
};