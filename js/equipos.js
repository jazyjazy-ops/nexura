function renderizarClientes(clientes) {
    const tabla = document.getElementById("tablaClientes");

    tabla.innerHTML = "";

    if (!clientes || clientes.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="9" class="sin-compras">
                    No se encontraron clientes.
                </td>
            </tr>
        `;
        return;
    }

    clientes.forEach(cliente => {
        const tieneCompras = Boolean(cliente.fecha_ultima_compra);

        const ultimaCompra = tieneCompras
            ? cliente.ultima_compra
            : "Sin compras";

        const fechaUltimaCompra = tieneCompras
            ? formatearFecha(cliente.fecha_ultima_compra)
            : "Sin registro";

        const productoMasComprado = cliente.producto_mas_comprado
            || "Sin información";

        const totalCompras = Number(cliente.total_compras) || 0;

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${cliente.id}</td>

            <td>${cliente.nombre}</td>

            <td>${cliente.telefono || "Sin teléfono"}</td>

            <td>${cliente.email || "Sin correo"}</td>

            <td class="${tieneCompras ? "" : "sin-compras"}">
                ${ultimaCompra}
            </td>

            <td class="fecha-compra ${tieneCompras ? "" : "sin-compras"}">
                ${fechaUltimaCompra}
            </td>

            <td>${productoMasComprado}</td>

            <td>
                <span class="total-compras">
                    ${totalCompras}
                </span>
            </td>

            <td>
                <button
                    class="btn-historial"
                    onclick="consultarHistorial(${cliente.id})"
                >
                    Historial
                </button>

                <button
                    class="btn-editar"
                    onclick="prepararEdicion(${cliente.id})"
                >
                    Editar
                </button>

                <button
                    class="btn-eliminar"
                    onclick="eliminarCliente(${cliente.id})"
                >
                    Eliminar
                </button>
            </td>
        `;

        tabla.appendChild(fila);
    });
}

function formatearFecha(fecha) {
    if (!fecha) {
        return "Sin registro";
    }

    return new Date(fecha).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

window.consultarHistorial = function (clienteId) {
    window.location.href = `historialCliente.html?cliente_id=${clienteId}`;
};