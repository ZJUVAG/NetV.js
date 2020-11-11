#version 300 es
precision highp float;
in vec3 inVertexPos;
in float in_shape;
in vec2 in_position;
in vec2 in_offset;
in float in_width; // rect
in float in_height; // rect
in float in_rotate; // rect
in float in_r; // circle
in vec2 in_vertex_alpha; // triangle
in vec2 in_vertex_beta; // triangle
in vec2 in_vertex_gamma; // triangle
in vec4 in_fill;
in float in_strokeWidth;
in vec4 in_strokeColor;

out vec2 position;
out float shape;
out float width; // rect
out float height; // rect
out float rotate; // rect
out float r; // circle
out vec2 vertex_alpha; // triangle
out vec2 vertex_beta; // triangle
out vec2 vertex_gamma; // triangle
out vec4 fill;
out float strokeWidth;
out vec4 strokeColor;

uniform mat3 projection;
uniform vec2 scale;
uniform vec2 translate;
uniform vec2 viewport;
uniform float pixelRatio;


vec2 calculate_inner_point (vec2 p1, vec2 p2, vec2 p3) {
    float inner_p1 = sqrt(dot(p1, p1));
    float inner_p2 = sqrt(dot(p2, p2));
    float inner_p3 = sqrt(dot(p3, p3));
    vec2 inner = (p1 * inner_p1 + p2 * inner_p2 + p3 * inner_p3) / (inner_p1 + inner_p2 + inner_p3);
    return inner;
}

float calculate_stroke_scale (vec2 p1, vec2 p2, vec2 p3) {
    vec2 inner = calculate_inner_point(p1, p2, p3);
    float a = distance(p1, inner);
    float b = distance(p2, inner);
    float c = distance(p1, p2);
    float cos_alpha = (pow(b, 2.0) + pow(c, 2.0) - pow(a, 2.0)) / (2.0 * b * c);
    float sin_alpha = sqrt(1.0 - pow(cos_alpha, 2.0));
    float normal_length = sin_alpha * a;
    float stroke_scale = 1.0 + strokeWidth / 2.0 * pixelRatio / normal_length;
    return stroke_scale;
}

void main(void) {
    r = in_r;
    width = in_width;
    height = in_height;
    shape = in_shape;
    fill = in_fill;
    strokeColor = in_strokeColor;
    strokeWidth = in_strokeWidth;
    rotate = in_rotate;
    
    position = scale * (in_position + in_offset) + translate;
    vertex_alpha = in_vertex_alpha * pixelRatio;
    vertex_beta = in_vertex_beta * pixelRatio;
    vertex_gamma = in_vertex_gamma * pixelRatio;

    mat3 scale_mat = mat3(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );
    mat3 rotate_mat = mat3(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );
    mat3 translate_mat = mat3(
        1, 0, 0,
        0, 1, 0,
        position.x, position.y, 1
    );

    if (shape == 0.0) { // circle shape
        float size = (r + strokeWidth / 2.) * 2. * 1.5;  // NOTE: multiply 2. to make radius to diameter; multiply 1.5 to prevent border factor
        scale_mat = mat3(
            size, 0, 0,
            0, size, 0,
            0, 0, 1
        );
    } else if (shape == 1.0) { // rect shape
        scale_mat = mat3(
            width + strokeWidth, 0, 0,
            0, height + strokeWidth, 0,
            0, 0, 1
        );
        rotate_mat = mat3(
            cos(rotate), sin(rotate), 0,
            -sin(rotate), cos(rotate), 0,
            0, 0, 1
        );
    } else if (shape == 2.0) { // triangle shape
        // calculate the normal of the edge: alpha => beta
        vec2 inner = calculate_inner_point(vertex_alpha, vertex_beta, vertex_gamma);
        float stroke_scale = calculate_stroke_scale(vertex_alpha, vertex_beta, vertex_gamma);

        vec2 outer_vertex_alpha = (vertex_alpha - inner) * stroke_scale + inner ; // consider stroke in
        vec2 outer_vertex_beta = (vertex_beta - inner) * stroke_scale + inner ; // consider stroke in
        vec2 outer_vertex_gamma = (vertex_gamma - inner) * stroke_scale + inner ; // consider stroke in


        width = (max(max(outer_vertex_alpha.x, outer_vertex_beta.x), outer_vertex_gamma.x) - min(min(outer_vertex_alpha.x, outer_vertex_beta.x), outer_vertex_gamma.x));
        height = stroke_scale * (max(max(outer_vertex_alpha.y, outer_vertex_beta.y), outer_vertex_gamma.y)- min(min(outer_vertex_alpha.y, outer_vertex_beta.y), outer_vertex_gamma.y));

        scale_mat = mat3(
            width, 0, 0,
            0, height, 0,
            0, 0, 1
        );
    }

    mat3 transform = translate_mat * rotate_mat * scale_mat;

    gl_Position = vec4(projection * transform * inVertexPos, 1.);
}