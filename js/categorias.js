let categoriasGenerales = [];
let modoEdicion = false;
let categoriaActualId = null;
let rolUsuarioActual = null;

// Paginación
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

    const rolesEdicion = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Sistemas'];
    if (!rolesEdicion.includes(rolUsuarioActual)) {
        const btnAgregar = document.querySelector(".btn-agregar");
        if (btnAgregar) btnAgregar.style.display = 'none';
    }

    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });

    await cargarCategorias(token);
    document.getElementById('inputBusqueda').addEventListener('input', filtrarCategorias);
});

async function cargarCategorias(token) {
    try {
        const res = await fetch("http://localhost:3000/api/categorias", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) return window.location.href = "login.html";
        
        categoriasGenerales = await res.json();
        datosFiltradosActuales = [...categoriasGenerales];
        renderizarTablaPaginada();
    } catch (error) {
        console.error("Error al cargar áreas:", error);
    }
}

function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaCategorias');
    tbody.innerHTML = '';

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No se encontraron áreas</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const categoriasPagina = datosFiltradosActuales.slice(indiceInicio, indiceInicio + registrosPorPagina);

    const rolesEdicion = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Sistemas'];
    const puedeEditar = rolesEdicion.includes(rolUsuarioActual);

    categoriasPagina.forEach(a => {
        const tr = document.createElement('tr');
        
        let botonesAccion = "";
        if (puedeEditar) {
            botonesAccion += `<button class="btn-editar" onclick="prepararEdicion(${a.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>`;
            botonesAccion += `<button class="btn-eliminar" onclick="eliminarCategoria(${a.id})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Eliminar</button>`;
        } else {
            botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;
        }

        tr.innerHTML = `
            <td>${a.id}</td>
            <td><strong>${a.nombre}</strong></td>
            <td><span class="estado normal">${a.estado || 'Activo'}</span></td>
            <td>
                <button class="btn-consultar" onclick="consultarProductos('${encodeURIComponent(a.nombre)}')">Consultar productos</button>
            </td>
            <td>${botonesAccion}</td>
        `;
        tbody.appendChild(tr);
    });

    renderizarControlesPaginacion(datosFiltradosActuales.length);
}

function renderizarControlesPaginacion(totalRegistros) {
    const contenedor = document.getElementById('controlesPaginacion');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (totalRegistros <= registrosPorPagina) return; 

    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);

    const btnAnterior = document.createElement('button');
    btnAnterior.textContent = 'Anterior';
    btnAnterior.disabled = paginaActual === 1;
    btnAnterior.onclick = () => { paginaActual--; renderizarTablaPaginada(); };

    const textoPagina = document.createElement('span');
    textoPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;

    const btnSiguiente = document.createElement('button');
    btnSiguiente.textContent = 'Siguiente';
    btnSiguiente.disabled = paginaActual === totalPaginas;
    btnSiguiente.onclick = () => { paginaActual++; renderizarTablaPaginada(); };

    contenedor.appendChild(btnAnterior);
    contenedor.appendChild(textoPagina);
    contenedor.appendChild(btnSiguiente);
}

function filtrarCategorias(e) {
    const termino = e.target.value.toLowerCase();
    datosFiltradosActuales = categoriasGenerales.filter(a => a.nombre.toLowerCase().includes(termino) || String(a.id).includes(termino));
    paginaActual = 1;
    renderizarTablaPaginada();
}

// Funciones del Modal (Ajusta los IDs de HTML según necesites)
function abrirModal() { document.getElementById("modalCategoria").style.display = "flex"; }
function cerrarModal() { document.getElementById("modalCategoria").style.display = "none"; }

window.prepararNuevaCategoria = function() {
    modoEdicion = false;
    categoriaActualId = null;
    document.getElementById("tituloModal").textContent = "Agregar Área";
    document.getElementById("formCategoria").reset();
    abrirModal();
}
const btnAgregar = document.querySelector(".btn-agregar");
if(btnAgregar) btnAgregar.onclick = window.prepararNuevaCategoria;

window.prepararEdicion = function(id) {
    modoEdicion = true;
    categoriaActualId = id;
    const a = categoriasGenerales.find(x => x.id === id);
    if (!a) return;
    document.getElementById("tituloModal").textContent = "Editar Área";
    document.getElementById('inputNombr').value = a.nombre;
    abrirModal();
}

document.getElementById('formCategoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');
    const payload = { nombre: document.getElementById('inputNombre').value };

    let url = "http://localhost:3000/api/categorias";
    let method = "POST";
    if (modoEdicion) {
        url = `http://localhost:3000/api/categorias/${categoriaActualId}`;
        method = "PUT";
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false });
            cerrarModal();
            await cargarCategorias(token);
        } else {
            const data = await res.json();
            Swal.fire({ icon: 'error', title: 'Error', text: data.Mensaje });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de red' });
    }
});

window.eliminarCategoria = async function(id) {
    const confirmacion = await Swal.fire({ title: '¿Eliminar área?', icon: 'warning', showCancelButton: true });
    if (confirmacion.isConfirmed) {
        const token = localStorage.getItem('nexura_token');
        const res = await fetch(`http://localhost:3000/api/categorias/${id}`, {
            method: 'DELETE', headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            Swal.fire('¡Eliminada!', '', 'success');
            await cargarCategorias(token);
        }
    }
}

window.consultarProductos = function(nombreCategoria) {
    window.location.href = `productos.html?categoria=${nombreCategoria}`;
};