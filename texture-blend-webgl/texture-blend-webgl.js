/*
 * For maximum modularity, we place everything within a single function that
 * takes the canvas that it will need.
 */
((canvas) => {
    /*
     * This code does not really belong here: it should live
     * in a separate library of matrix and transformation
     * functions.  It is here only to show you how matrices
     * can be used with GLSL.
     *
     * Based on the original glRotate reference:
     *     https://www.khronos.org/registry/OpenGL-Refpages/es1.1/xhtml/glRotate.xml
     */
    let getRotationMatrix = (angle, x, y, z) => {
        // In production code, this function should be associated
        // with a matrix object with associated functions.
        let axisLength = Math.sqrt((x * x) + (y * y) + (z * z));
        let s = Math.sin(angle * Math.PI / 180.0);
        let c = Math.cos(angle * Math.PI / 180.0);
        let oneMinusC = 1.0 - c;

        // Normalize the axis vector of rotation.
        x /= axisLength;
        y /= axisLength;
        z /= axisLength;

        // Now we can calculate the other terms.
        // "2" for "squared."
        let x2 = x * x;
        let y2 = y * y;
        let z2 = z * z;
        let xy = x * y;
        let yz = y * z;
        let xz = x * z;
        let xs = x * s;
        let ys = y * s;
        let zs = z * s;

        // GL expects its matrices in column major order.
        return [
            (x2 * oneMinusC) + c,
            (xy * oneMinusC) + zs,
            (xz * oneMinusC) - ys,
            0.0,

            (xy * oneMinusC) - zs,
            (y2 * oneMinusC) + c,
            (yz * oneMinusC) + xs,
            0.0,

            (xz * oneMinusC) + ys,
            (yz * oneMinusC) - xs,
            (z2 * oneMinusC) + c,
            0.0,

            0.0,
            0.0,
            0.0,
            1.0
        ];
    };

    /*
     * This is another function that really should reside in a
     * separate library.  But, because the creation of that library
     * is part of the student course work, we leave it here for
     * later refactoring and adaptation by students.
     */
    let getOrthoMatrix = (left, right, bottom, top, zNear, zFar) => {
        let width = right - left;
        let height = top - bottom;
        let depth = zFar - zNear;

        return [
            2.0 / width,
            0.0,
            0.0,
            0.0,

            0.0,
            2.0 / height,
            0.0,
            0.0,

            0.0,
            0.0,
            -2.0 / depth,
            0.0,

            -(right + left) / width,
            -(top + bottom) / height,
            -(zFar + zNear) / depth,
            1.0
        ];
    };

    // Grab the WebGL rendering context.
    let gl = GLSLUtilities.getGL(canvas);
    if (!gl) {
        alert("No WebGL context found...sorry.");

        // No WebGL, no use going on...
        return;
    }

    // Set up settings that will not change.  This is not "canned" into a
    // utility function because these settings really can vary from program
    // to program.
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Set up the texture object.
    let goldTexture = gl.createTexture();
    let waterTexture = gl.createTexture();

    let readyTexture = 0;
    let loadHandlerFor = (texture, textureImage, textureId) => {
        return () => {
            gl.activeTexture(textureId);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
            gl.generateMipmap(gl.TEXTURE_2D);
            readyTexture += 1;
        };
    };

    // In the general case, promises will work better for tracking these loads.
    let goldImage = new Image();
    goldImage.onload = loadHandlerFor(goldTexture, goldImage, gl.TEXTURE0);
    goldImage.src = "gold.jpg";

    let waterImage = new Image();
    waterImage.onload = loadHandlerFor(waterTexture, waterImage, gl.TEXTURE1);
    waterImage.src = "water.jpg";

    // Build the objects to display. We do some mesh manipulation here to get
    // the desired effect.
    let goldMesh = Shapes.icosahedron();
    goldMesh.indices = goldMesh.indices.filter((triangle, index) => index % 2);

    let waterMesh = Shapes.icosahedron();
    waterMesh.indices = waterMesh.indices.filter((triangle, index) => !(index % 2));

    let objectsToDraw = [
        {
            vertices: Shapes.toRawTriangleArray(goldMesh),

            color: { r: 1.0, g: 0.0, b: 0.0 },
            specularColor: { r: 1.0, g: 1.0, b: 1.0 },
            shininess: 16,

            // Like colors, one normal per vertex. Now simplified with a helper function.
            normals: Shapes.toNormalArray(goldMesh),

            // One more array to associate with our vertices---texture coordinates!
            // Here we generate them raw...some design thought may be needed in order
            // to create/manage them in a more convenient way.
            textureCoordinates: (() => {
                let result = [];
                for (let i = 0; i < 10; i += 1) {
                    result.push(0.0, 0.0, 1.0, 0.0, 0.0, 1.0);
                }
                return result;
            })(),

            mode: gl.TRIANGLES
        },

        {
            vertices: Shapes.toRawTriangleArray(waterMesh),

            color: { r: 0.0, g: 0.0, b: 1.0 },
            specularColor: { r: 1.0, g: 1.0, b: 1.0 },
            shininess: 16,

            // Like colors, one normal per vertex. Now simplified with a helper function.
            normals: Shapes.toNormalArray(waterMesh),

            // One more array to associate with our vertices---texture coordinates!
            // Here we generate them raw...some design thought may be needed in order
            // to create/manage them in a more convenient way.
            textureCoordinates: (() => {
                let result = [];
                for (let i = 0; i < 10; i += 1) {
                    result.push(0.0, 0.0, 1.0, 0.0, 0.0, 1.0);
                }
                return result;
            })(),

            mode: gl.TRIANGLES
        }
    ];

    // Pass the vertices to WebGL.
    objectsToDraw.forEach((objectToDraw) => {
        objectToDraw.vertexBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.vertices);

        if (!objectToDraw.colors) {
            // If we have a single color, we expand that into an array
            // of the same color over and over.
            objectToDraw.colors = [];
            for (let i = 0, maxi = objectToDraw.vertices.length / 3; i < maxi; i += 1) {
                objectToDraw.colors = objectToDraw.colors.concat(
                    objectToDraw.color.r,
                    objectToDraw.color.g,
                    objectToDraw.color.b
                );
            }
        }
        objectToDraw.colorBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.colors);

        // Same trick with specular colors.
        if (!objectToDraw.specularColors) {
            // Future refactor: helper function to convert a single value or
            // array into an array of copies of itself.
            objectToDraw.specularColors = [];
            for (let j = 0, maxj = objectToDraw.vertices.length / 3; j < maxj; j += 1) {
                objectToDraw.specularColors = objectToDraw.specularColors.concat(
                    objectToDraw.specularColor.r,
                    objectToDraw.specularColor.g,
                    objectToDraw.specularColor.b
                );
            }
        }
        objectToDraw.specularBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.specularColors);

        // One more buffer: normals.
        objectToDraw.normalBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.normals);

        // And one more still: texture coordinates.
        objectToDraw.textureCoordinateBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.textureCoordinates);
    });

    // Initialize the shaders.
    let abort = false;
    let shaderProgram = GLSLUtilities.initSimpleShaderProgram(
        gl,
        $("#vertex-shader").text(),
        $("#fragment-shader").text(),

        // Very cursory error-checking here...
        (shader) => {
            abort = true;
            alert("Shader problem: " + gl.getShaderInfoLog(shader));
        },

        // Another simplistic error check: we don't even access the faulty
        // shader program.
        (shaderProgram) => {
            abort = true;
            alert("Could not link shaders...sorry.");
        }
    );

    // If the abort variable is true here, we can't continue.
    if (abort) {
        alert("Fatal errors encountered; we cannot continue.");
        return;
    }

    // All done --- tell WebGL to use the shader program from now on.
    gl.useProgram(shaderProgram);

    // Hold on to the important variables within the shaders.
    let vertexPosition = gl.getAttribLocation(shaderProgram, "vertexPosition");
    gl.enableVertexAttribArray(vertexPosition);
    let vertexDiffuseColor = gl.getAttribLocation(shaderProgram, "vertexDiffuseColor");
    gl.enableVertexAttribArray(vertexDiffuseColor);
    let vertexSpecularColor = gl.getAttribLocation(shaderProgram, "vertexSpecularColor");
    gl.enableVertexAttribArray(vertexSpecularColor);
    let normalVector = gl.getAttribLocation(shaderProgram, "normalVector");
    gl.enableVertexAttribArray(normalVector);
    let textureCoordinate = gl.getAttribLocation(shaderProgram, "textureCoordinate");
    gl.enableVertexAttribArray(textureCoordinate);

    // Finally, we come to the typical setup for transformation matrices:
    // model-view and projection, managed separately.
    let modelViewMatrix = gl.getUniformLocation(shaderProgram, "modelViewMatrix");
    let xRotationMatrix = gl.getUniformLocation(shaderProgram, "xRotationMatrix");
    let yRotationMatrix = gl.getUniformLocation(shaderProgram, "yRotationMatrix");
    let projectionMatrix = gl.getUniformLocation(shaderProgram, "projectionMatrix");

    // Note the additional variables.
    let lightPosition = gl.getUniformLocation(shaderProgram, "lightPosition");
    let lightDiffuse = gl.getUniformLocation(shaderProgram, "lightDiffuse");
    let lightSpecular = gl.getUniformLocation(shaderProgram, "lightSpecular");
    let shininess = gl.getUniformLocation(shaderProgram, "shininess");

    let alpha = gl.getUniformLocation(shaderProgram, "alpha");

    /*
     * Displays an individual object, including a transformation that now varies
     * for each object drawn.
     */
    let drawObject = (object) => {
        // Set the varying colors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.colorBuffer);
        gl.vertexAttribPointer(vertexDiffuseColor, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, object.specularBuffer);
        gl.vertexAttribPointer(vertexSpecularColor, 3, gl.FLOAT, false, 0, 0);

        // Set the shininess.
        gl.uniform1f(shininess, object.shininess);

        // Set up the model-view matrix, if an axis is included.  If not, we
        // specify the identity matrix.
        gl.uniformMatrix4fv(modelViewMatrix, gl.FALSE, new Float32Array(object.rotation ?
            getRotationMatrix(object.rotation.theta, object.rotation.x, object.rotation.y, object.rotation.z) :
            [1, 0, 0, 0, // N.B. In a full-fledged matrix library, the identity
             0, 1, 0, 0, //      matrix should be available as a function.
             0, 0, 1, 0,
             0, 0, 0, 1]
        ));

        // Set the varying normal vectors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.normalBuffer);
        gl.vertexAttribPointer(normalVector, 3, gl.FLOAT, false, 0, 0);

        // Set the texture varialbes.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.textureCoordinateBuffer);
        gl.vertexAttribPointer(textureCoordinate, 2, gl.FLOAT, false, 0, 0);

        // Set the varying vertex coordinates.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vertexBuffer);
        gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(object.mode, 0, object.vertices.length / 3);
    };

    /*
     * Displays the scene.
     */
    let rotationAroundX = 0.0;
    let rotationAroundY = 0.0;
    let drawScene = () => {
        // Clear the display.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Set the overall rotation.
        gl.uniformMatrix4fv(xRotationMatrix, gl.FALSE, new Float32Array(
            getRotationMatrix(rotationAroundX, 1.0, 0.0, 0.0)
        ));
        gl.uniformMatrix4fv(yRotationMatrix, gl.FALSE, new Float32Array(
            getRotationMatrix(rotationAroundY, 0.0, 1.0, 0.0)
        ));

        // Display the objects. Note the highly scene-specific code here, just to make it
        // expedient for demonstrating blending. Generalizing this code (e.g., making opacity
        // a shape or object property) is pretty much a must-have.
        objectsToDraw.forEach((objectToDraw, index) => {
            // We make the first half of our objects gold/opaque, and the next half
            // water/translucent---translucent objects need to be drawn last because
            // otherwise the blending will be incorrent.
            let opaque = index < objectsToDraw.length / 2;
            gl.uniform1i(gl.getUniformLocation(shaderProgram, "sampler"), opaque ? 0 : 1);
            if (opaque) {
                gl.enable(gl.DEPTH_TEST);
                gl.disable(gl.BLEND);
                gl.uniform1f(alpha, 1.0);
            } else {
                gl.disable(gl.DEPTH_TEST);
                gl.enable(gl.BLEND);
                gl.uniform1f(alpha, 0.5);
            }

            drawObject(objectToDraw);
        });

        // All done.
        gl.flush();
    };

    /*
     * Performs rotation calculations.
     */
    let xDragStart;
    let yDragStart;
    let xRotationStart;
    let yRotationStart;

    let rotateScene = (event) => {
        rotationAroundX = xRotationStart - yDragStart + event.clientY;
        rotationAroundY = yRotationStart - xDragStart + event.clientX;
        drawScene();
    };

    // Because our canvas element will not change size (in this program),
    // we can set up the projection matrix once, and leave it at that.
    // Note how this finally allows us to "see" a greater coordinate range.
    // We keep the vertical range fixed, but change the horizontal range
    // according to the aspect ratio of the canvas.  We can also expand
    // the z range now.
    gl.uniformMatrix4fv(projectionMatrix, gl.FALSE, new Float32Array(getOrthoMatrix(
        -2 * (canvas.width / canvas.height),
        2 * (canvas.width / canvas.height),
        -2,
        2,
        -10,
        10
    )));

    // Set up our one light source and its colors.
    gl.uniform4fv(lightPosition, [-10.0, 10.0, 100.0, 1.0]);
    gl.uniform3fv(lightDiffuse, [1.0, 1.0, 1.0]);
    gl.uniform3fv(lightSpecular, [1.0, 1.0, 1.0]);

    // Set up our texture sampler.
    gl.uniform1i(gl.getUniformLocation(shaderProgram, "sampler"), 0);

    // Instead of animation, we do interaction: let the mouse control rotation.
    $(canvas).mousedown((event) => {
        xDragStart = event.clientX;
        yDragStart = event.clientY;
        xRotationStart = rotationAroundX;
        yRotationStart = rotationAroundY;
        $(canvas).mousemove(rotateScene);
    }).mouseup((event) => {
        $(canvas).unbind("mousemove");
    });

    // Draw the initial scene. But we will wait until the textures are ready.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    let drawWhenReady = () => {
        if (readyTexture === 2) {
            drawScene();
        } else {
            window.requestAnimationFrame(drawWhenReady);
        }
    };

    window.requestAnimationFrame(drawWhenReady);
})(document.getElementById("texture-blend-webgl"));
