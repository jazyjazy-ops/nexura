let marcasGenerales = [];
let modoEdicion = false;
let marcaActualId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("nexura_token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    await cargarMarcas(token);
});

async function cargarMarcas(token) {
    try {
        const res = await fetch("http://localhost:3000/api/marcas", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const marcas = await res.json();
        marcasGenerales = marcas;

        renderizarTabla(marcasGenerales);

    } catch (error) {
        console.error("Error al cargar marcas:", error);
    }
}

function renderizarTabla(marcas) {
    const tbody = document.getElementById("tablaMarcas");
    tbody.innerHTML = "";

    if (marcas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No se encontraron marcas</td>
            </tr>
        `;
        return;
    }

    marcas.forEach(marca => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${marca.id}</td>
            <td>${marca.nombre}</td>
            <td>${marca.descripcion || "Sin descripción"}</td>
            <td>
                <button class="btn-consultar">Consultar productos</button>
            </td>
            <td>
                <button class="btn-editar" onclick="prepararEdicion(${marca.id})">Editar</button>
                <button class="btn-eliminar" onclick="eliminarMarca(${marca.id})">Eliminar</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

document.getElementById("inputBusqueda").addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase();

    const marcasFiltradas = marcasGenerales.filter(marca => {
        return (
            marca.nombre.toLowerCase().includes(texto) ||
            String(marca.id).includes(texto) ||
            (marca.descripcion || "").toLowerCase().includes(texto)
        );
    });

    renderizarTabla(marcasFiltradas);
});

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
    const token = localStorage.getItem("nexura_token");

    const confirmacion = await Swal.fire({
        title: "¿Eliminar marca?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (!confirmacion.isConfirmed) return;

    try {
        const res = await fetch(`http://localhost:3000/api/marcas/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

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