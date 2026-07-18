document.addEventListener("DOMContentLoaded", async () => {
    // Protección de ruta
    const token = localStorage.getItem('nexura_token');
    const usuarioStr = localStorage.getItem('nexura_usuario');

    if (!token || !usuarioStr) {
        window.location.href = "login.html";
        return;
    }

    // Inyectar datos del usuario
    const usuario = JSON.parse(usuarioStr);
    document.getElementById('nombreUsuario').textContent = usuario.nombre;
    document.getElementById('rolUsuario').textContent = usuario.departamento || 'Administración';

    // Configurar cierre de sesión
    document.getElementById('btnCerrarSesion').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('nexura_token');
        localStorage.removeItem('nexura_usuario');
        window.location.href = "login.html";
    });

    await cargarDatosDashboard(token);
});

async function cargarDatosDashboard(token) {
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    try {
        // Peticiones simultáneas a los endpoints de la API
        const [resProductos, resLotes] = await Promise.all([
            fetch("http://localhost:3000/api/productos", { headers }),
            fetch("http://localhost:3000/api/lotes", { headers })
        ]);

        if (resProductos.status === 401) {
            Swal.fire({
                icon: 'warning',
                title: 'Sesión expirada',
                text: 'Por favor, vuelve a iniciar sesión.'
            }).then(() => {
                localStorage.clear();
                window.location.href = "login.html";
            });
            return;
        }

        const productos = await resProductos.json();
        const lotes = await resLotes.json();

        procesarMetricasYGraficas(productos, lotes);

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor para obtener las métricas.'
        });
    }
}

function procesarMetricasYGraficas(productos, lotes) {
    // 1. Calcular el stock actual agrupando los lotes por producto
    const stockPorProducto = {};
    lotes.forEach(lote => {
        if (!stockPorProducto[lote.producto_id]) {
            stockPorProducto[lote.producto_id] = 0;
        }
        stockPorProducto[lote.producto_id] += Number(lote.cantidad_disponible);
    });

    let contNormal = 0;
    let contBajo = 0;
    let contSinStock = 0;

    const costosPorArea = {};
    const listaStock = []; // Arreglo nuevo para clasificar el Top 5

    // 2. Evaluar cada producto contra su stock mínimo
    productos.forEach(prod => {
        const stockActual = stockPorProducto[prod.id] || 0;
        const area = prod.area_nombre || 'Sin clasificar';

        // Clasificación para las tarjetas
        if (stockActual === 0) {
            contSinStock++;
        } else if (stockActual <= prod.stock_minimo) {
            contBajo++;
        } else {
            contNormal++;
        }

        // Agrupación para gráfica 1: Costo total por área
        if (!costosPorArea[area]) costosPorArea[area] = 0;
        costosPorArea[area] += (stockActual * Number(prod.precio));

        // Insertar en la lista para la nueva gráfica
        listaStock.push({
            nombre: prod.nombre,
            stock: stockActual
        });
    });

    // 3. Actualizar Tarjetas en el DOM
    document.getElementById('cardTotal').textContent = productos.length;
    document.getElementById('cardNormal').textContent = contNormal;
    document.getElementById('cardBajo').textContent = contBajo;
    document.getElementById('cardSinStock').textContent = contSinStock;

    // 4. Preparar el Top 5 Crítico
    // Ordenamos la lista matemáticamente de menor a mayor stock
    listaStock.sort((a, b) => a.stock - b.stock);
    // Extraemos solo los primeros 5
    const top5Critico = listaStock.slice(0, 5);

    // 5. Renderizar Gráficas
    renderizarGraficaCostos(costosPorArea);
    renderizarGraficaTopCritico(top5Critico); // Llamamos a la nueva función
}

// (Tu función renderizarGraficaCostos se queda exactamente igual)

function renderizarGraficaTopCritico(top5) {
    const ctx = document.getElementById('graficaTopCritico').getContext('2d');
    
    // Separamos los nombres y las cantidades para Chart.js
    const nombres = top5.map(p => p.nombre);
    const cantidades = top5.map(p => p.stock);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [{
                label: 'Unidades Disponibles',
                data: cantidades,
                backgroundColor: 'rgba(243, 156, 18, 0.8)', // Color de advertencia
                borderColor: 'rgba(230, 126, 34, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Esto es lo que gira la gráfica horizontalmente
            responsive: true,
            plugins: {
                legend: { display: false } // Ocultamos la leyenda para que se vea más limpio
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderizarGraficaCostos(datos) {
    const ctx = document.getElementById('graficaCostos').getContext('2d');
    const etiquetas = Object.keys(datos);
    const valores = Object.values(datos);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Costo Monetario ($)',
                data: valores,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(41, 128, 185, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

