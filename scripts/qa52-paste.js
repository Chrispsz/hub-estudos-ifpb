const ta = document.querySelector('[aria-label="Bloco de código para o tutor"]');
if (!ta) { 'NO-TA' } else {
  const code = `#include <stdio.h>
#include <math.h>

void main(){
    float a,b,c;
    printf("Informe os coeficientes da equacao:");
    scanf("%f %f %f", &a, &b, &c);
    float delta = (pow(b,2))-(4*a*c);
    if (delta > 0) {
        float x1 = (-b + sqrt(delta)) / (2*a);
        float x2 = (-b - sqrt(delta)) / (2*a);
        printf("As raizes sao %.1f e %.1f\\n", x1, x2);
    }
    else if (delta == 0) {
        float x1 = -b / (2*a);
        printf("A raiz eh %.1f\\n", x1);
    }
    else {
        printf("Nao existem raizes reais\\n");
    }
}`;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, code);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  'PASTED ' + code.split('\n').length + ' lines';
}
