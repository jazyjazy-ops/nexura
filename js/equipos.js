let equiposGenerales = [];
let modoEdicion = false;
let equipoActualId = null;
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
    
    // Es buena práctica cargar los catálogos antes o al mismo tiempo que la tabla
    await cargarSelects(token);
    await cargarEquipos(token);

    const selectPermiso = document.getElementById('selectPermiso');
    const inputTermino = document.getElementById('inputFechaTermino');

    selectPermiso.addEventListener('change', (e) => {
        if (e.target.value === "Permanente") {
            inputTermino.disabled = true;
            inputTermino.value = "";
        } else {
            inputTermino.disabled = false;
        }
    });

    document.getElementById('inputBusqueda').addEventListener('input', filtrarEquipos);
});

async function cargarSelects(token) {
    try {
        const headers = { "Authorization": `Bearer ${token}` };
        const [resAreas, resMarcas, resClientes] = await Promise.all([
            fetch("http://localhost:3000/api/areas", { headers }),
            fetch("http://localhost:3000/api/marcas", { headers }),
            fetch("http://localhost:3000/api/clientes", { headers })
        ]);
        
        if (resAreas.ok) {
            const areas = await resAreas.json();
            const selectArea = document.getElementById('selectArea');
            if (selectArea) {
                areas.forEach(a => selectArea.appendChild(new Option(a.nombre, a.id)));
            }
        }

        if (resMarcas.ok) {
            const marcas = await resMarcas.json();
            const selectMarca = document.getElementById('selectMarca');
            if (selectMarca) {
                marcas.forEach(m => selectMarca.appendChild(new Option(m.nombre, m.id)));
            }
        }

        // Llenar select de Clientes de forma segura
        if (resClientes.ok) {
            const clientes = await resClientes.json();
            const selectCliente = document.getElementById('selectCliente');
            if (selectCliente) {
                clientes.forEach(c => {
                    if (c.estado !== 'Inactivo') {
                        selectCliente.appendChild(new Option(c.nombre_comercial || c.nombre, c.id));
                    }
                });
            } else {
                console.warn("Advertencia: No se encontró el elemento con id='selectCliente' en el HTML.");
            }
        }
    } catch (error) {
        console.error("Error al cargar selects:", error);
    }
}

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
        
        // Inicializamos los datos filtrados con todos los equipos
        datosFiltradosActuales = [...equiposGenerales];
        
        // Llamamos a la nueva función de paginación
        renderizarTablaPaginada();
    } catch (error) {
        console.error("Error al cargar equipos:", error);
    }
}

// --- NUEVA FUNCIÓN: RENDERIZAR TABLA PAGINADA ---
function renderizarTablaPaginada() {
    const tbody = document.getElementById('tablaEquipos');
    tbody.innerHTML = '';

    if (!datosFiltradosActuales || datosFiltradosActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No se encontraron equipos</td></tr>';
        renderizarControlesPaginacion(0);
        return;
    }

    // Calcular índices de inicio y fin
    const indiceInicio = (paginaActual - 1) * registrosPorPagina;
    const indiceFin = indiceInicio + registrosPorPagina;
    const equiposPagina = datosFiltradosActuales.slice(indiceInicio, indiceFin);

    const rolesTecnicos = ['Direccion', 'Sub-Direccion', 'Gerencia de Operaciones', 'Jefe de Ingenieria', 'Ingeniero', 'Sistemas'];
    const rolesEliminacion = ['Direccion', 'Sub-Direccion', 'Sistemas'];
    
    const puedeEditar = rolesTecnicos.includes(rolUsuarioActual);
    const puedeEliminar = rolesEliminacion.includes(rolUsuarioActual);

    // Iteramos SOLO sobre los equipos de la página actual
    equiposPagina.forEach(eq => {
        const tr = document.createElement('tr');

        // Función auxiliar para mostrar fechas legibles
        const formatearFecha = (fechaStr) => {
            if (!fechaStr) return 'N/A';
            return new Date(fechaStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
        };

        // Colores de estado
        let claseEstado = eq.estado === 'Activo' ? 'normal' : 'roja';

        // Botones
        let botonesAccion = "";
        if (puedeEditar) botonesAccion += `<button class="btn-editar" onclick="prepararEdicion(${eq.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>`;
        // Usamos eq.estado === 'Activo' para que no salga el botón "Desactivar" si ya está inactivo
        if (puedeEliminar && eq.estado === 'Activo') botonesAccion += `<button class="btn-eliminar" onclick="eliminarEquipo(${eq.id})" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Desactivar</button>`;
        if (!puedeEditar && !puedeEliminar) botonesAccion = `<span style="color: #95a5a6; font-size: 0.9em;">Solo lectura</span>`;

        tr.innerHTML = `
            <td>${eq.id}</td>
            <td><strong>${eq.nombre}</strong></td>
            <td>${eq.numero_serie}</td>
            <td>${eq.permiso || 'N/A'}</td>
            <td>${formatearFecha(eq.duracion_permiso) || 'N/A'}</td>
            <td>${eq.area_nombre || 'N/A'}</td>
            <td>${eq.marca_nombre || 'N/A'}</td>
            <td>${eq.cliente_nombre || 'Interno / N/A'}</td>
            <td>${formatearFecha(eq.fecha_instalacion)}</td>
            <td>${formatearFecha(eq.fecha_mantenimiento)}</td>
            <td><span class="estado ${claseEstado}">${eq.estado}</span></td>
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
function filtrarEquipos(e) {
    const termino = e.target.value.toLowerCase();
    
    // Actualizamos el arreglo de datos filtrados
    datosFiltradosActuales = equiposGenerales.filter(eq => {
        return (
            (eq.nombre && eq.nombre.toLowerCase().includes(termino)) ||
            (eq.marca_nombre && eq.marca_nombre.toLowerCase().includes(termino)) || 
            (eq.numero_serie && eq.numero_serie.toLowerCase().includes(termino)) ||
            (eq.cliente_nombre && eq.cliente_nombre.toLowerCase().includes(termino)) ||
            (eq.area_nombre && eq.area_nombre.toLowerCase().includes(termino))
        );
    });
    
    // Reiniciamos a la página 1 cada vez que se busca algo
    paginaActual = 1;
    renderizarTablaPaginada();
}

window.prepararEdicion = function(id) {
    modoEdicion = true;
    equipoActualId = id;
    const eq = equiposGenerales.find(e => e.id === id);
    if (!eq) return;

    document.getElementById("tituloModal").textContent = "Editar equipo";
    
    // Inputs de texto protegidos contra nulos
    document.getElementById('inputNombre').value = eq.nombre || '';
    document.getElementById('inputSerie').value = eq.numero_serie || '';

    // FUNCIÓN AUXILIAR SEGURA: Inyecta el valor al select solo si existe, y maneja los nulos
    const asignarSelectSeguro = (idElemento, valor) => {
        const select = document.getElementById(idElemento);
        if (select) {
            // Si el valor es estrictamente nulo o indefinido, asigna '', si no, asigna el valor
            select.value = (valor === null || valor === undefined) ? '' : valor;
        } else {
            console.warn(`No se encontró el select con ID: ${idElemento}`);
        }
    };

    // Aplicamos la función segura a todos los selects
    asignarSelectSeguro('selectArea', eq.area_id);
    asignarSelectSeguro('selectMarca', eq.marca_id);
    asignarSelectSeguro('selectCliente', eq.cliente_id); 
    asignarSelectSeguro('selectEstado', eq.estado);

    // Helper para parsear la fecha y que los inputs type="date" la puedan leer
    const parseFechaInput = (fechaStr) => fechaStr ? fechaStr.split('T')[0] : '';
    
    document.getElementById('inputFechaInstalacion').value = parseFechaInput(eq.fecha_instalacion);
    document.getElementById('inputFechaMantenimiento').value = parseFechaInput(eq.fecha_mantenimiento);
    document.getElementById('inputFechaMantenimiento').value = parseFechaInput(eq.duracion_permiso);

    abrirModalEquipo();
}

// --- GUARDAR CAMBIOS (POST/PUT) ---
document.getElementById('formEquipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');

    const getValueOrNull = (id) => document.getElementById(id).value || null;

    // Payload actualizado con todos los campos de la nueva tabla
    const payload = {
        nombre: document.getElementById('inputNombre').value,
        numero_serie: document.getElementById('inputSerie').value,
        permiso: document.getElementById('selectPermiso').value,
        duracion_permiso: getValueOrNull('inputFechaTermino'),
        area_id: parseInt(document.getElementById('selectArea').value),
        marca_id: document.getElementById('selectMarca').value ? parseInt(document.getElementById('selectMarca').value) : null,
        cliente_id: document.getElementById('selectCliente').value ? parseInt(document.getElementById('selectCliente').value) : null,
        fecha_instalacion: getValueOrNull('inputFechaInstalacion'),
        fecha_mantenimiento: getValueOrNull('inputFechaMantenimiento'),
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
        title: '¿Desactivar equipo?',
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
                Swal.fire({ icon: "warning", title: "Acceso Denegado", text: "Solo directivos pueden desactivar equipos." });
                return;
            }

            const data = await res.json();
            if (res.ok) {
                Swal.fire('¡Desactivado!', 'El equipo fue dado de baja.', 'success');
                await cargarEquipos(token);
            } else {
                Swal.fire('Error', data.Mensaje, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de conexión.', 'error');
        }
    }
}